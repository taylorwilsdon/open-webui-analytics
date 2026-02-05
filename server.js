import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

// Load environment variables from .env file if it exists
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

// Database configuration
let DATABASE_URL = process.env.DATABASE_URL
let db
let isPostgreSQL = false
let setupMode = false

// Check if we need to run setup
if (!DATABASE_URL) {
  const defaultDbPath = join(__dirname, 'webui.db')
  if (!fs.existsSync(defaultDbPath)) {
    setupMode = true
    console.log('No database configuration found. Starting in setup mode.')
  } else {
    DATABASE_URL = `sqlite:///${defaultDbPath}`
  }
}

// Initialize database if not in setup mode
if (!setupMode) {
  if (DATABASE_URL.startsWith('postgresql://') || DATABASE_URL.startsWith('postgres://')) {
    isPostgreSQL = true
    const { Pool } = pg
    db = new Pool({
      connectionString: DATABASE_URL,
    })
  } else if (DATABASE_URL.startsWith('sqlite://')) {
    const dbPath = DATABASE_URL.replace('sqlite:///', '').replace('sqlite://', '')
    db = new Database(dbPath, { readonly: true })
  } else {
    throw new Error('Unsupported database URL. Only SQLite and PostgreSQL are supported.')
  }
}

app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:5173'],
  credentials: true
}))
app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

// Setup routes
if (setupMode) {
  app.get('/setup', (req, res) => {
    res.json({ setupRequired: true })
  })

  app.post('/setup/test-sqlite', async (req, res) => {
    try {
      const { filePath } = req.body
      
      if (!filePath) {
        return res.status(400).json({ error: 'File path is required' })
      }
      
      // Expand ~ to home directory
      const expandedPath = filePath.startsWith('~') 
        ? join(process.env.HOME || process.env.USERPROFILE || '', filePath.slice(2))
        : filePath
      
      if (!fs.existsSync(expandedPath)) {
        return res.status(404).json({ error: 'File not found' })
      }
      
      // Test opening the database
      const testDb = new Database(expandedPath, { readonly: true })
      testDb.close()
      
      res.json({ success: true, path: expandedPath })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  app.post('/setup/configure', async (req, res) => {
    console.log('Setup configure request received:', req.body)
    try {
      const { type, config } = req.body
      
      if (type === 'postgresql') {
        const { host, port, database, username, password } = config
        const connectionString = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${database}`
        
        // Test connection
        const { Pool } = pg
        const testDb = new Pool({ connectionString })
        await testDb.query('SELECT 1')
        await testDb.end()
        
        // Save configuration to .env file
        const envContent = `DATABASE_URL=${connectionString}\n`
        fs.writeFileSync(join(__dirname, '.env'), envContent)
        
        res.json({ success: true, message: 'PostgreSQL configuration saved successfully' })
      } else if (type === 'sqlite') {
        const { filePath } = config
        
        if (!filePath) {
          return res.status(400).json({ error: 'File path is required' })
        }
        
        // Expand ~ to home directory
        const expandedPath = filePath.startsWith('~') 
          ? join(process.env.HOME || process.env.USERPROFILE || '', filePath.slice(2))
          : filePath
        
        if (!fs.existsSync(expandedPath)) {
          return res.status(400).json({ error: 'SQLite database file not found at: ' + expandedPath })
        }
        
        // Test opening the database
        const testDb = new Database(expandedPath, { readonly: true })
        testDb.close()
        
        // Save configuration to .env file
        const envContent = `DATABASE_URL=sqlite:///${expandedPath}\n`
        fs.writeFileSync(join(__dirname, '.env'), envContent)
        
        res.json({ success: true, message: 'SQLite configuration saved successfully' })
      } else {
        res.status(400).json({ error: 'Invalid database type' })
      }
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  app.post('/setup/restart', (req, res) => {
    res.json({ success: true, message: 'Restarting server...' })
    setTimeout(() => {
      process.exit(0)
    }, 1000)
  })

  // Handle API routes in setup mode
  app.get('/api/*', (req, res) => {
    res.status(503).json({ 
      error: 'Database not configured. Please complete setup first.', 
      setupRequired: true,
      setupUrl: '/setup'
    })
  })

  // For non-API routes in setup mode, let the frontend handle routing
  app.get('*', (req, res) => {
    res.status(503).json({ 
      error: 'Database not configured. Setup required.', 
      setupRequired: true 
    })
  })
}

// Database query helpers (only available in non-setup mode)
if (!setupMode) {

async function executeQuery(query, params = []) {
  if (isPostgreSQL) {
    const result = await db.query(query, params)
    return result.rows
  } else {
    const stmt = db.prepare(query)
    if (params.length > 0) {
      return stmt.all(...params)
    } else {
      return stmt.all()
    }
  }
}

async function executeQuerySingle(query, params = []) {
  if (isPostgreSQL) {
    const result = await db.query(query, params)
    return result.rows[0] || {}
  } else {
    const stmt = db.prepare(query)
    if (params.length > 0) {
      return stmt.get(...params) || {}
    } else {
      return stmt.get() || {}
    }
  }
}

// Convert SQLite JSON queries to PostgreSQL
function adaptQuery(sqliteQuery) {
  if (!isPostgreSQL) {
    return sqliteQuery
  }
  
  // Convert SQLite json_extract to PostgreSQL jsonb operators
  let query = sqliteQuery
    .replace(/json_extract\(([^,]+),\s*'\$\.([^']+)'\)/g, '$1->\'$2\'')
    .replace(/json_extract\(([^,]+),\s*'\$\.([^.]+)\.([^']+)'\)/g, '$1->\'$2\'->\'$3\'')
    .replace(/json_each\(json_extract\(([^,]+),\s*'\$\.([^']+)'\)\)/g, 'jsonb_array_elements($1->\'$2\')')
    .replace(/json_each\(([^)]+)\)/g, 'jsonb_array_elements($1)')
    .replace(/date\(([^,]+),\s*'unixepoch'\)/g, 'date(to_timestamp($1))')
    .replace(/datetime\(([^,]+),\s*'unixepoch'\)/g, 'to_timestamp($1)')
  
  return query
}

app.get('/api/stats/overview', async (req, res) => {
  try {
    // Calculate total tokens from all chat messages
    let tokenQuery = `
      SELECT 
        SUM(LENGTH(json_extract(msg.value, '$.content'))) as total_chars
      FROM chat c,
           json_each(json_extract(c.chat, '$.history.messages')) as msg
      WHERE json_extract(msg.value, '$.content') IS NOT NULL
        AND json_extract(msg.value, '$.content') != ''
    `
    
    if (isPostgreSQL) {
      tokenQuery = `
        SELECT 
          SUM(LENGTH(msg->>'content')) as total_chars
        FROM chat c,
             jsonb_array_elements(c.chat->'history'->'messages') as msg
        WHERE msg->>'content' IS NOT NULL
          AND msg->>'content' != ''
      `
    }
    
    const tokenResult = await executeQuerySingle(tokenQuery)
    const estimatedTokens = Math.round((tokenResult.total_chars || 0) / 4)
    
    // Calculate total tool usage
    let toolQuery = `
      SELECT COUNT(*) as count
      FROM chat c,
           json_each(json_extract(c.chat, '$.history.messages')) as msg,
           json_each(json_extract(msg.value, '$.statusHistory')) as status
      WHERE json_extract(status.value, '$.action') IS NOT NULL
        AND json_extract(status.value, '$.done') = 1
    `
    
    if (isPostgreSQL) {
      toolQuery = `
        SELECT COUNT(*) as count
        FROM chat c,
             jsonb_array_elements(c.chat->'history'->'messages') as msg,
             jsonb_array_elements(msg->'statusHistory') as status
        WHERE status->>'action' IS NOT NULL
          AND (status->>'done')::int = 1
      `
    }
    
    const toolResult = await executeQuerySingle(toolQuery)
    
    const totalUsersResult = await executeQuerySingle('SELECT COUNT(*) as count FROM "user"')
    const totalChatsResult = await executeQuerySingle('SELECT COUNT(*) as count FROM chat')
    const activeUsersQuery = isPostgreSQL 
      ? `SELECT COUNT(DISTINCT user_id) as count FROM chat WHERE created_at > $1`
      : `SELECT COUNT(DISTINCT user_id) as count FROM chat WHERE created_at > ?`
    const activeUsersResult = await executeQuerySingle(
      activeUsersQuery,
      [Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60]
    )
    const totalModelsResult = await executeQuerySingle('SELECT COUNT(*) as count FROM model WHERE is_active = true')
    
    const stats = {
      totalUsers: totalUsersResult.count,
      totalChats: totalChatsResult.count,
      activeUsers: activeUsersResult.count,
      totalModels: totalModelsResult.count,
      estimatedTokens: estimatedTokens,
      toolUsage: toolResult.count
    }
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/stats/models', async (req, res) => {
  try {
    let query = `
      SELECT 
        json_extract(msg.value, '$.model') as model,
        COUNT(*) as usage_count,
        SUM(LENGTH(COALESCE(json_extract(msg.value, '$.content'), ''))) as total_chars
      FROM chat c,
           json_each(json_extract(c.chat, '$.history.messages')) as msg
      WHERE json_extract(msg.value, '$.model') IS NOT NULL
      GROUP BY model
      ORDER BY usage_count DESC
      LIMIT 20
    `
    
    if (isPostgreSQL) {
      query = `
        SELECT 
          msg->>'model' as model,
          COUNT(*) as usage_count,
          SUM(LENGTH(COALESCE(msg->>'content', ''))) as total_chars
        FROM chat c,
             jsonb_array_elements(c.chat->'history'->'messages') as msg
        WHERE msg->>'model' IS NOT NULL
        GROUP BY model
        ORDER BY usage_count DESC
        LIMIT 20
      `
    }
    
    const models = await executeQuery(query)
    const modelsWithTokens = models.map(model => ({
      ...model,
      estimated_tokens: Math.round((model.total_chars || 0) / 4)
    }))
    res.json(modelsWithTokens)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/stats/activity', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30
    const startTime = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60)
    
    const query = isPostgreSQL ? `
      SELECT 
        date(to_timestamp(created_at)) as date,
        COUNT(*) as chat_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM chat
      WHERE created_at > $1
      GROUP BY date
      ORDER BY date DESC
    ` : `
      SELECT 
        date(created_at, 'unixepoch') as date,
        COUNT(*) as chat_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM chat
      WHERE created_at > ?
      GROUP BY date
      ORDER BY date DESC
    `
    
    const activity = await executeQuery(query, [startTime])
    res.json(activity)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/stats/users', async (req, res) => {
  try {
    let query = `
      SELECT 
        u.id,
        u.name,
        u.role,
        COUNT(c.id) as chat_count,
        MAX(c.updated_at) as last_activity,
        COALESCE(token_stats.estimated_tokens, 0) as estimated_tokens
      FROM "user" u
      LEFT JOIN chat c ON u.id = c.user_id
      LEFT JOIN (
        SELECT 
          c.user_id,
          SUM(LENGTH(COALESCE(json_extract(msg.value, '$.content'), ''))) / 4 as estimated_tokens
        FROM chat c,
             json_each(json_extract(c.chat, '$.history.messages')) as msg
        WHERE json_extract(msg.value, '$.content') IS NOT NULL
          AND json_extract(msg.value, '$.content') != ''
        GROUP BY c.user_id
      ) as token_stats ON u.id = token_stats.user_id
      GROUP BY u.id, u.name, u.role
      ORDER BY chat_count DESC
      LIMIT 50
    `
    
    if (isPostgreSQL) {
      query = `
        SELECT 
          u.id,
          u.name,
          u.role,
          COUNT(c.id) as chat_count,
          MAX(c.updated_at) as last_activity,
          COALESCE(token_stats.estimated_tokens, 0) as estimated_tokens
        FROM "user" u
        LEFT JOIN chat c ON u.id = c.user_id
        LEFT JOIN (
          SELECT 
            c.user_id,
            SUM(LENGTH(COALESCE(msg->>'content', ''))) / 4 as estimated_tokens
          FROM chat c,
               jsonb_array_elements(c.chat->'history'->'messages') as msg
          WHERE msg->>'content' IS NOT NULL
            AND msg->>'content' != ''
          GROUP BY c.user_id
        ) as token_stats ON u.id = token_stats.user_id
        GROUP BY u.id, u.name, u.role
        ORDER BY chat_count DESC
        LIMIT 50
      `
    }
    
    const users = await executeQuery(query)
    const usersWithTokens = users.map(user => ({
      ...user,
      estimated_tokens: Math.round(user.estimated_tokens || 0)
    }))
    res.json(usersWithTokens)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/stats/tools', async (req, res) => {
  try {
    // Get built-in tools from statusHistory
    let builtinQuery = `
      SELECT 
        json_extract(status.value, '$.action') as tool_name,
        COUNT(*) as usage_count,
        COUNT(DISTINCT c.user_id) as unique_users,
        COUNT(DISTINCT c.id) as unique_chats,
        'builtin' as tool_type
      FROM chat c,
           json_each(json_extract(c.chat, '$.history.messages')) as msg,
           json_each(json_extract(msg.value, '$.statusHistory')) as status
      WHERE json_extract(status.value, '$.action') IS NOT NULL
        AND json_extract(status.value, '$.done') = 1
      GROUP BY tool_name
    `
    
    let customQuery = `
      WITH tool_extracts AS (
        SELECT DISTINCT
          c.user_id,
          c.id as chat_id,
          CASE 
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_get_events_post"%' THEN 'google_calendar'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_list_calendars_post"%' THEN 'google_calendar' 
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_create_event_post"%' THEN 'google_calendar'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_delete_event_post"%' THEN 'google_calendar'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_modify_event_post"%' THEN 'google_calendar'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_get_gmail%"%' THEN 'gmail'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_search_gmail%"%' THEN 'gmail'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_send_gmail%"%' THEN 'gmail'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_draft_gmail%"%' THEN 'gmail'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_modify_gmail%"%' THEN 'gmail'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="get_today_tasks"%' THEN 'todoist'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="get_upcoming_tasks"%' THEN 'todoist'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="get_todoist_tasks"%' THEN 'todoist'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="resolve_todoist_task"%' THEN 'todoist'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="get_current_weather"%' THEN 'accuweather'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="get_future_weather%"%' THEN 'accuweather'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_search_drive%"%' THEN 'google_drive'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_get_drive%"%' THEN 'google_drive'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_create_drive%"%' THEN 'google_drive'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_list_drive%"%' THEN 'google_drive'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_search_docs%"%' THEN 'google_docs'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_get_doc%"%' THEN 'google_docs'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_create_doc%"%' THEN 'google_docs'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="slack_%"%' THEN 'slack'
            WHEN json_extract(msg.value, '$.content') LIKE '%name="tool_list_spaces%"%' THEN 'google_spaces'
            WHEN json_extract(msg.value, '$.content') LIKE '%quantbook%"%' OR json_extract(msg.value, '$.content') LIKE '%quantconnect%"%' THEN 'quantconnect'
            ELSE NULL
          END as tool_name
        FROM chat c,
             json_each(json_extract(c.chat, '$.history.messages')) as msg
        WHERE json_extract(msg.value, '$.content') LIKE '%<details type="tool_calls"%'
          AND json_extract(msg.value, '$.content') LIKE '%done="true"%'
      )
      SELECT 
        tool_name,
        COUNT(*) as usage_count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT chat_id) as unique_chats,
        'custom' as tool_type
      FROM tool_extracts 
      WHERE tool_name IS NOT NULL
      GROUP BY tool_name
    `
    
    if (isPostgreSQL) {
      builtinQuery = `
        SELECT 
          status->>'action' as tool_name,
          COUNT(*) as usage_count,
          COUNT(DISTINCT c.user_id) as unique_users,
          COUNT(DISTINCT c.id) as unique_chats,
          'builtin' as tool_type
        FROM chat c,
             jsonb_array_elements(c.chat->'history'->'messages') as msg,
             jsonb_array_elements(msg->'statusHistory') as status
        WHERE status->>'action' IS NOT NULL
          AND (status->>'done')::int = 1
        GROUP BY tool_name
      `
      
      customQuery = `
        WITH tool_extracts AS (
          SELECT DISTINCT
            c.user_id,
            c.id as chat_id,
            CASE 
              WHEN msg->>'content' LIKE '%name="tool_get_events_post"%' THEN 'google_calendar'
              WHEN msg->>'content' LIKE '%name="tool_list_calendars_post"%' THEN 'google_calendar' 
              WHEN msg->>'content' LIKE '%name="tool_create_event_post"%' THEN 'google_calendar'
              WHEN msg->>'content' LIKE '%name="tool_delete_event_post"%' THEN 'google_calendar'
              WHEN msg->>'content' LIKE '%name="tool_modify_event_post"%' THEN 'google_calendar'
              WHEN msg->>'content' LIKE '%name="tool_get_gmail%"%' THEN 'gmail'
              WHEN msg->>'content' LIKE '%name="tool_search_gmail%"%' THEN 'gmail'
              WHEN msg->>'content' LIKE '%name="tool_send_gmail%"%' THEN 'gmail'
              WHEN msg->>'content' LIKE '%name="tool_draft_gmail%"%' THEN 'gmail'
              WHEN msg->>'content' LIKE '%name="tool_modify_gmail%"%' THEN 'gmail'
              WHEN msg->>'content' LIKE '%name="get_today_tasks"%' THEN 'todoist'
              WHEN msg->>'content' LIKE '%name="get_upcoming_tasks"%' THEN 'todoist'
              WHEN msg->>'content' LIKE '%name="get_todoist_tasks"%' THEN 'todoist'
              WHEN msg->>'content' LIKE '%name="resolve_todoist_task"%' THEN 'todoist'
              WHEN msg->>'content' LIKE '%name="get_current_weather"%' THEN 'accuweather'
              WHEN msg->>'content' LIKE '%name="get_future_weather%"%' THEN 'accuweather'
              WHEN msg->>'content' LIKE '%name="tool_search_drive%"%' THEN 'google_drive'
              WHEN msg->>'content' LIKE '%name="tool_get_drive%"%' THEN 'google_drive'
              WHEN msg->>'content' LIKE '%name="tool_create_drive%"%' THEN 'google_drive'
              WHEN msg->>'content' LIKE '%name="tool_list_drive%"%' THEN 'google_drive'
              WHEN msg->>'content' LIKE '%name="tool_search_docs%"%' THEN 'google_docs'
              WHEN msg->>'content' LIKE '%name="tool_get_doc%"%' THEN 'google_docs'
              WHEN msg->>'content' LIKE '%name="tool_create_doc%"%' THEN 'google_docs'
              WHEN msg->>'content' LIKE '%name="slack_%"%' THEN 'slack'
              WHEN msg->>'content' LIKE '%name="tool_list_spaces%"%' THEN 'google_spaces'
              WHEN msg->>'content' LIKE '%quantbook%"%' OR msg->>'content' LIKE '%quantconnect%"%' THEN 'quantconnect'
              ELSE NULL
            END as tool_name
          FROM chat c,
               jsonb_array_elements(c.chat->'history'->'messages') as msg
          WHERE msg->>'content' LIKE '%<details type="tool_calls"%'
            AND msg->>'content' LIKE '%done="true"%'
        )
        SELECT 
          tool_name,
          COUNT(*) as usage_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT chat_id) as unique_chats,
          'custom' as tool_type
        FROM tool_extracts 
        WHERE tool_name IS NOT NULL
        GROUP BY tool_name
      `
    }
    
    const builtinTools = await executeQuery(builtinQuery)
    const customTools = await executeQuery(customQuery)
    
    // Combine and sort all tools
    const allTools = [...builtinTools, ...customTools]
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 20)
    
    res.json(allTools)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

} // End of non-setup mode

const PORT = process.env.PORT || 3001
app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')))
app.listen(PORT, () => {
  if (setupMode) {
    console.log(`Analytics API server running in setup mode on port ${PORT}`)
    console.log(`Visit http://localhost:${PORT}/setup to configure your database`)
  } else {
    console.log(`Analytics API server running on port ${PORT}`)
  }
})