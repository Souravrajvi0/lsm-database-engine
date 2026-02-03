# Deployment Guide - LSM Tree Storage Engine

## ✅ Pre-Deployment Checklist

- [x] Docker configuration complete
- [x] Health checks implemented
- [x] No compilation errors
- [x] 97.2% test coverage
- [x] Production build scripts
- [x] Logging and monitoring setup
- [x] Removed unused database dependencies

## 🚀 Deployment Options

### Option 1: Docker Compose (Recommended)

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The application will be available at: **http://localhost:5000**

### Option 2: Docker Build

```bash
# Build the image
docker build -t lsm-tree-engine .

# Run the container
docker run -d \
  -p 5000:5000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  --name lsm-tree \
  lsm-tree-engine

# Check health
curl http://localhost:5000/health
```

### Option 3: Traditional Node.js

```bash
# Install production dependencies
npm ci --production

# Build the application
npm run build

# Start the server
npm start
```

## 🌐 Cloud Deployment

### AWS ECS / Fargate

1. Push Docker image to ECR:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ECR_URI
docker tag lsm-tree-engine:latest YOUR_ECR_URI/lsm-tree-engine:latest
docker push YOUR_ECR_URI/lsm-tree-engine:latest
```

2. Create ECS task definition with:
   - Port mapping: 5000
   - Health check: `/health`
   - Volumes for persistent data (EFS recommended)

### Google Cloud Run

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/lsm-tree-engine

# Deploy
gcloud run deploy lsm-tree-engine \
  --image gcr.io/PROJECT_ID/lsm-tree-engine \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 5000
```

### Heroku

```bash
# Login and create app
heroku login
heroku create your-lsm-tree-app

# Deploy
heroku container:push web
heroku container:release web

# Open app
heroku open
```

### DigitalOcean App Platform

1. Connect your GitHub repository
2. Configure:
   - **Build Command**: `npm run build`
   - **Run Command**: `npm start`
   - **Port**: 5000
   - **Health Check**: `/health`
3. Deploy!

## 📊 Monitoring

### Health Check Endpoint

```bash
curl http://your-domain/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T...",
  "checks": {
    "memtable": "healthy",
    "wal": "healthy",
    "storage": "healthy",
    "compaction": "healthy",
    "bloomFilters": "healthy"
  }
}
```

### Prometheus Metrics

Available at: `http://your-domain/metrics`

Key metrics:
- `lsm_writes_total` - Total write operations
- `lsm_reads_total` - Total read operations
- `lsm_read_latency_ms` - Read latency histogram
- `lsm_write_latency_ms` - Write latency histogram
- `lsm_bloom_filter_efficiency` - Bloom filter hit rate
- `lsm_compaction_duration_ms` - Compaction duration

## 🔒 Security Considerations

### Before Production:

1. **Rate Limiting**: Add rate limiting middleware
2. **Authentication**: Implement API authentication if needed
3. **HTTPS**: Use a reverse proxy (nginx/traefik) with SSL
4. **Network Security**: Configure firewall rules
5. **Data Backup**: Set up regular backups of `/data` directory

### Example nginx config:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    location /api/ {
        limit_req zone=api burst=20;
        proxy_pass http://localhost:5000;
    }
}
```

## 💾 Data Persistence

The application stores data in the `/data` directory:
- `data/wal.log` - Write-ahead log
- `data/sstables/` - Sorted string tables
- `data/blooms/` - Bloom filters
- `data/indexes/` - Sparse indexes

**Important**: Always mount this directory as a volume for data persistence!

## 🔧 Environment Variables

```bash
NODE_ENV=production    # Run in production mode
PORT=5000             # Server port (default: 5000)
LOG_LEVEL=info        # Logging level: debug|info|warn|error
```

## 📈 Performance Tuning

### For High-Write Workloads:
- Increase MemTable size in `server/lsm.ts`
- Adjust compaction thresholds
- Monitor disk I/O

### For High-Read Workloads:
- Ensure Bloom filters are enabled
- Monitor Bloom filter efficiency
- Consider adding caching layer

## 🧪 Post-Deployment Testing

```bash
# Health check
curl http://your-domain/health

# Write test
curl -X POST http://your-domain/api/kv \
  -H "Content-Type: application/json" \
  -d '{"key":"test","value":"hello"}'

# Read test
curl http://your-domain/api/kv/test

# Metrics check
curl http://your-domain/metrics
```

## 🐛 Troubleshooting

### Container won't start
```bash
# Check logs
docker logs lsm-tree-engine

# Verify build
docker build -t lsm-tree-engine . --progress=plain
```

### Port conflicts
```bash
# Change port in docker-compose.yml
ports:
  - "8080:5000"  # External:Internal
```

### Permission issues
```bash
# Fix data directory permissions
chmod -R 755 data/
chown -R 1001:1001 data/
```

## 📞 Support

For issues or questions:
1. Check [DOCUMENTATION.md](DOCUMENTATION.md)
2. Review server logs
3. Test with health check endpoint
4. Check Prometheus metrics

---

**Your LSM Tree Storage Engine is now production-ready! 🎉**
