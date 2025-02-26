module.exports = {
  apps: [{
    name: 'oracle-price-updater',
    script: 'ts-node',
    args: 'scripts/oracle_price_updater.ts',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    exp_backoff_restart_delay: 100,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      NODE_ENV: 'development'
    }
  }]
}; 