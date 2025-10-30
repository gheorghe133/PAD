# Lab 3 - Cloud Deployment (Railway)

Migrarea proiectului Lab 2 (Web Proxy + Data Warehouse) în cloud folosind **Railway.app**.

## Arhitectură Cloud

```
┌─────────────────────────────────────────────────────┐
│ Railway Cloud Platform                              │
│                                                      │
│  ┌────────────────────┐      ┌───────────────────┐ │
│  │ Service 1          │      │ Service 2         │ │
│  │ Data Warehouse     │◄─────┤ Reverse Proxy     │ │
│  │ Port: $PORT        │      │ Port: $PORT       │ │
│  │ Node.js + Express  │      │ Load Balancer     │ │
│  └────────────────────┘      └───────────────────┘ │
│           ▲                           ▲             │
│           │                           │             │
│  ┌────────┴────────┐         ┌────────┴──────────┐ │
│  │ Redis Database  │         │ Public URL        │ │
│  │ (Managed)       │         │ https://...       │ │
│  └─────────────────┘         └───────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Servicii Deploy-ate

### 1. Data Warehouse Service

- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Port**: Dinamic (Railway $PORT)
- **Endpoints**:
  - `GET /employees`
  - `GET /employees/:id`
  - `PUT /employees/:id`
  - `POST /employees/:id`
  - `DELETE /employees/:id`

### 2. Reverse Proxy Service

- **Runtime**: Node.js 16+
- **Features**:
  - Load Balancing (Round-Robin)
  - Response Caching (TTL-based)
  - Connection Pooling
- **Port**: Dinamic (Railway $PORT)

### 3. Redis Database

- **Type**: Managed Redis (Railway Plugin)
- **Usage**: Caching + Connection Management
- **Connection**: Automatic via environment variables

## Deployment Steps

### Pas 1: Pregătire Repository

```bash
# Asigură-te că ești în Lab 3
cd "Lab 3"

# Verifică fișierele
ls -la
```

### Pas 2: Push la GitHub

```bash
# Inițializează git (dacă nu e deja)
git init
git add .
git commit -m "Lab 3: Railway deployment setup"

# Push la GitHub
git remote add origin https://github.com/USERNAME/PAD.git
git push -u origin main
```

### Pas 3: Deploy pe Railway

#### 3.1 Creează Proiect Nou

1. Mergi pe [railway.app](https://railway.app)
2. Click **"New Project"**
3. Selectează **"Deploy from GitHub repo"**
4. Alege repository-ul tău

#### 3.2 Deploy Data Warehouse

1. Click **"Add Service"** → **"GitHub Repo"**
2. Selectează branch-ul `main`
3. Root Directory: `Lab 3`
4. Start Command: `node src/warehouse/server.js`
5. **Environment Variables**:
   ```
   NODE_ENV=production
   DW_PORT=$PORT
   ```

#### 3.3 Adaugă Redis

1. Click **"New"** → **"Database"** → **"Add Redis"**
2. Railway va crea automat variabilele:
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD`
3. Link Redis la Data Warehouse service

#### 3.4 Deploy Reverse Proxy

1. Click **"Add Service"** → **"GitHub Repo"**
2. Root Directory: `Lab 3`
3. Start Command: `node src/proxy/server.js`
4. **Environment Variables**:
   ```
   NODE_ENV=production
   PROXY_PORT=$PORT
   DW_SERVERS=<data-warehouse-internal-url>:3000
   ```

#### 3.5 Generează Public URL

1. Selectează Proxy service
2. Click **"Settings"** → **"Networking"**
3. Click **"Generate Domain"**
4. Primești URL public: `https://your-app.up.railway.app`

## Environment Variables

### Data Warehouse Service

```bash
NODE_ENV=production
PORT=3000                    # Railway setează automat
DW_HOST=0.0.0.0
REDIS_HOST=<from-railway>
REDIS_PORT=<from-railway>
REDIS_PASSWORD=<from-railway>
```

### Reverse Proxy Service

```bash
NODE_ENV=production
PORT=8080                    # Railway setează automat
PROXY_HOST=0.0.0.0
DW_SERVERS=warehouse-service:3000
REDIS_HOST=<from-railway>
REDIS_PORT=<from-railway>
REDIS_PASSWORD=<from-railway>
```

## Testing

### Test Data Warehouse Direct

```bash
# GET all employees
curl https://warehouse-service.up.railway.app/employees

# GET specific employee
curl https://warehouse-service.up.railway.app/employees/1

# CREATE employee
curl -X PUT https://warehouse-service.up.railway.app/employees/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","position":"Developer","salary":50000}'
```

### Test prin Proxy

```bash
# Request prin proxy (cu caching)
curl https://proxy-service.up.railway.app/employees

# Verifică cache HIT
curl -v https://proxy-service.up.railway.app/employees
# Caută header: X-Cache: HIT
```

## Monitoring

### Railway Dashboard

- **Logs**: Real-time logs pentru fiecare service
- **Metrics**: CPU, Memory, Network usage
- **Deployments**: Istoric deploy-uri

### Health Checks

```bash
# Check warehouse health
curl https://warehouse-service.up.railway.app/health

# Check proxy health
curl https://proxy-service.up.railway.app/health
```

## Cost Estimation

Railway Free Tier:

- **$5 credit/lună** gratuit
- **500 ore execution** (~20 zile 24/7)
- **100GB bandwidth**

Servicii folosite:

- Data Warehouse: ~$2/lună
- Proxy: ~$2/lună
- Redis: ~$1/lună
- **Total**: ~$5/lună (GRATUIT cu credit)

## Troubleshooting

### Service nu pornește

```bash
# Verifică logs în Railway Dashboard
# Caută erori de port binding sau dependencies
```

### Redis connection failed

```bash
# Verifică că Redis service e linked
# Verifică environment variables sunt setate
```

### 502 Bad Gateway

```bash
# Verifică că serviciul ascultă pe $PORT
# Verifică că host e "0.0.0.0" nu "localhost"
```

## Sarcini Lab 3 Completate

- [x] **Sarcina de bază (Opțiunea 2)**: Migrare proiect în Cloud

  - [x] Creat instanțe virtuale (Railway services)
  - [x] Copiat aplicații pe instanțe
  - [x] Configurat reverse proxy
  - [x] Reprezentat sistem ca diagramă

- [ ] **Sarcină adițională**: CI/CD cu GitHub Actions
- [ ] **Sarcină adițională**: Containerizare cu Docker
- [ ] **Sarcină adițională**: Integrare Cloud services (Redis managed)
- [ ] **Sarcină adițională**: Infrastructure as Code (Terraform)

## Referințe

- [Railway Documentation](https://docs.railway.app/)
- [Railway Node.js Guide](https://docs.railway.app/guides/nodejs)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [Lab 2 Original](../Lab%202/README.md)
