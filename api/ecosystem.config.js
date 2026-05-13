 module.exports = {
    apps: [
      {
        name: 'bulk-data',
        script: '/opt/bulk-data/api/dist/main.js',
        instances: 'max', // Utilize all CPU cores
        autorestart: true,
        watch: false,
        max_memory_restart: '5G', // Restart if the memory usage exceeds this value
        env: process.env.PORT,
        log_date_format: '', // Format for log timestamps
        error_file: '/opt/logs/bulk-data/pm2/err.log', // Path to error log file
        out_file: '/opt/logs/bulk-data/pm2/out.log', // Path to standard output log file
        combine_logs: true,
        pre_deploy: 'yarn build',
      },
    ],
  };

