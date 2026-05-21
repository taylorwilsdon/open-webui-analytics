<script>
  import { onMount } from 'svelte'
  import { api } from '../lib/api.js'
  
  let users = []
  let loading = true
  let error = null
  
  onMount(async () => {
    try {
      users = await api.getUsers()
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  })
  
  function formatDate(timestamp) {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }
  
  function getRoleBadgeClass(role) {
    return {
      admin: 'badge-admin',
      user: 'badge-user', 
      pending: 'badge-pending'
    }[role] || 'badge-user'
  }
  
  function getActivityLevel(chatCount) {
    if (chatCount >= 50) return 'high'
    if (chatCount >= 10) return 'medium'
    if (chatCount > 0) return 'low'
    return 'none'
  }
  
  function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Never active'
    const now = Date.now()
    const time = timestamp * 1000
    const diff = now - time
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    if (days < 365) return `${Math.floor(days / 30)} months ago`
    return `${Math.floor(days / 365)} years ago`
  }
  
  function formatTokenCount(count) {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toLocaleString()
  }
</script>

<div class="user-stats">
  <div class="section-header">
    <h2>User Analytics</h2>
    <p>Insights into user engagement, activity patterns, and platform adoption</p>
  </div>
  
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading user analytics...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h3>Unable to Load User Data</h3>
      <p>{error}</p>
    </div>
  {:else if users.length > 0}
    <div class="users-container fade-in">
      <div class="users-overview">
        <div class="overview-grid">
          <div class="overview-card">
            <div class="card-icon">👥</div>
            <div class="card-content">
              <div class="card-value">{users.length}</div>
              <div class="card-label">Total Users</div>
            </div>
          </div>
          
          <div class="overview-card">
            <div class="card-icon">👨‍💼</div>
            <div class="card-content">
              <div class="card-value">{users.filter(u => u.role === 'admin').length}</div>
              <div class="card-label">Administrators</div>
            </div>
          </div>
          
          <div class="overview-card">
            <div class="card-icon">🔥</div>
            <div class="card-content">
              <div class="card-value">{users.filter(u => u.chat_count > 0).length}</div>
              <div class="card-label">Active Users</div>
            </div>
          </div>
          
          <div class="overview-card">
            <div class="card-icon">🪙</div>
            <div class="card-content">
              <div class="card-value">
                {formatTokenCount(users.reduce((sum, u) => sum + (u.estimated_tokens || 0), 0))}
              </div>
              <div class="card-label">Total Tokens</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="users-list">
        <div class="list-header">
          <h3>User Activity Details</h3>
          <p>Detailed breakdown of individual user engagement and activity</p>
        </div>
        
        <div class="users-grid">
          {#each users as user, i}
            <div class="user-card slide-up" style="animation-delay: {i * 0.05}s">
              <div class="user-header">
                <div class="user-avatar">
                  {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div class="user-info">
                  <h4 class="user-name">{user.name || user.id}</h4>
                  <div class="user-meta">
                    <span class="badge {getRoleBadgeClass(user.role)}">
                      {user.role}
                    </span>
                    <span class="activity-indicator activity-{getActivityLevel(user.chat_count)}">
                      {getActivityLevel(user.chat_count)} activity
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="user-stats-grid">
                <div class="stat-item">
                  <div class="stat-icon">💬</div>
                  <div class="stat-details">
                    <div class="stat-value">{user.chat_count.toLocaleString()}</div>
                    <div class="stat-label">Total Chats</div>
                  </div>
                </div>
                
                <div class="stat-item">
                  <div class="stat-icon">🪙</div>
                  <div class="stat-details">
                    <div class="stat-value">{formatTokenCount(user.estimated_tokens || 0)}</div>
                    <div class="stat-label">Est. Tokens</div>
                  </div>
                </div>
                
                <div class="stat-item">
                  <div class="stat-icon">⏰</div>
                  <div class="stat-details">
                    <div class="stat-value">{formatRelativeTime(user.last_activity)}</div>
                    <div class="stat-label">Last Seen</div>
                  </div>
                </div>
              </div>
              
              {#if user.models && user.models.length > 0}
                <div class="user-models">
                  <div class="models-label">Models Used</div>
                  <div class="models-tags">
                    {#each user.models as m}
                      <span class="model-tag" title={m.model}>
                        <span class="model-name">{m.model}</span>
                        <span class="model-count">{m.count}</span>
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
              
              <div class="user-engagement">
                <div class="engagement-bar-container">
                  <div class="engagement-bar-label">Engagement Level</div>
                  <div class="engagement-bar-track">
                    <div 
                      class="engagement-bar engagement-{getActivityLevel(user.chat_count)}"
                      style="width: {Math.min((user.chat_count / 100) * 100, 100)}%"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <div class="empty-icon">👤</div>
      <h3>No User Data Available</h3>
      <p>No users found in the system.</p>
    </div>
  {/if}
</div>

<style>
  .user-stats {
    min-height: 500px;
  }
  
  .section-header {
    text-align: center;
    margin-bottom: 3rem;
  }
  
  .section-header h2 {
    font-size: clamp(1.5rem, 3vw, 2rem);
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
  
  .section-header p {
    color: var(--text-secondary);
    font-size: 1rem;
  }
  
  .loading-state, .error-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--bg-tertiary);
    border-top: 3px solid var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error-state {
    color: var(--error);
  }
  
  .error-icon, .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .users-container {
    display: flex;
    flex-direction: column;
    gap: 3rem;
  }
  
  .users-overview {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 4px var(--shadow);
  }
  
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
  }
  
  .overview-card {
    background: var(--bg-tertiary);
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.3s ease;
  }
  
  .overview-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--shadow);
  }
  
  .card-icon {
    font-size: 2rem;
    opacity: 0.4;
    filter: grayscale(60%);
  }
  
  .card-content {
    flex: 1;
  }
  
  .card-value {
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1;
    margin-bottom: 0.25rem;
  }
  
  .card-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .users-list {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 4px var(--shadow);
  }
  
  .list-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .list-header h3 {
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    font-size: 1.25rem;
  }
  
  .list-header p {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .users-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1.5rem;
  }
  
  .user-card {
    background: var(--bg-tertiary);
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.3s ease;
    border: 1px solid var(--border);
  }
  
  .user-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px var(--shadow);
  }
  
  .user-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .user-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  
  .user-info {
    flex: 1;
    min-width: 0;
  }
  
  .user-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
    word-break: break-word;
  }
  
  .user-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .badge-admin {
    background: var(--warning);
    color: white;
  }
  
  .badge-user {
    background: var(--accent-light);
    color: var(--accent);
  }
  
  .badge-pending {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }
  
  .activity-indicator {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }
  
  .activity-high {
    background: #dcfce7;
    color: var(--success);
  }
  
  .activity-medium {
    background: #fef3c7;
    color: var(--warning);
  }
  
  .activity-low {
    background: #dbeafe;
    color: var(--accent);
  }
  
  .activity-none {
    background: var(--bg-tertiary);
    color: var(--text-muted);
  }
  
  .user-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-primary);
    border-radius: 8px;
  }
  
  .stat-icon {
    font-size: 1.25rem;
    opacity: 0.4;
    filter: grayscale(60%);
  }
  
  .stat-details {
    flex: 1;
    min-width: 0;
  }
  
  .stat-value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
    margin-bottom: 0.125rem;
  }
  
  .stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .user-engagement {
    margin-top: 1rem;
  }
  
  .engagement-bar-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .engagement-bar-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .engagement-bar-track {
    height: 6px;
    background: var(--bg-primary);
    border-radius: 3px;
    overflow: hidden;
  }
  
  .engagement-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.8s ease;
  }
  
  .engagement-high {
    background: var(--success);
  }
  
  .engagement-medium {
    background: var(--warning);
  }
  
  .engagement-low {
    background: var(--accent);
  }
  
  .engagement-none {
    background: var(--text-muted);
  }
  
  .user-models {
    margin-top: 1.25rem;
    margin-bottom: 1.25rem;
    padding-top: 0.75rem;
    border-top: 1px dashed var(--border);
  }
  
  .models-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 600;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .models-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-height: 80px;
    overflow-y: auto;
    padding-right: 2px;
  }
  
  .models-tags::-webkit-scrollbar {
    width: 4px;
  }
  
  .models-tags::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .models-tags::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }
  
  .model-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    font-family: monospace;
    max-width: 100%;
  }
  
  .model-name {
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .model-count {
    background: var(--accent-light);
    color: var(--accent);
    padding: 0.05rem 0.25rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
  }
  
  @media (max-width: 768px) {
    .overview-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    .users-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    .user-card {
      padding: 1.25rem;
    }
    
    .user-stats-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
    
    .stat-item {
      padding: 0.75rem;
    }
  }
</style>