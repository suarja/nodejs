# Refactoring Auth Router - Documentation

## 🎯 Objectif

Refactoriser le router API pour utiliser le middleware `authenticateUser` d'editia-core au lieu de gérer l'authentification manuellement dans chaque endpoint.

## ✅ Changements Effectués

### 1. Structure du Router

**Avant :**

```typescript
// Tous les endpoints sur le même router
apiRouter.post("/s3-upload", uploadS3Handler);
apiRouter.get("/videos", async (req, res) => {
  // Authentification manuelle dans chaque handler
  const authHeader = req.headers.authorization;
  const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(
    authHeader
  );
  if (authError) return res.status(authError.status).json(authError);
  // ... logique métier
});
```

**Après :**

```typescript
// ============================================================================
// PUBLIC ENDPOINTS (No authentication required)
// ============================================================================
apiRouter.get("/health", (req, res) => {
  /* ... */
});
apiRouter.get("/auth-test", async (req, res) => {
  /* ... */
});
apiRouter.post("/test/streaming", async (req, res) => {
  /* ... */
});
apiRouter.use("/webhooks", webhooksRouter);

// ============================================================================
// AUTHENTICATED ENDPOINTS (Require authentication)
// ============================================================================
const authRoutes = express.Router();
authRoutes.use(authenticateUser); // Middleware global

authRoutes.post("/s3-upload", uploadS3Handler);
authRoutes.get("/videos", async (req, res) => {
  // req.user est déjà disponible grâce au middleware
  const userId = req.user!.id;
  // ... logique métier simplifiée
});

apiRouter.use("/", authRoutes);
```

### 2. Endpoints Publics (Sans Authentification)

- `GET /api/health` - Health check
- `GET /api/auth-test` - Test d'authentification (debug)
- `POST /api/test/streaming` - Test de streaming
- `POST /api/webhooks/*` - Webhooks (généralement pas d'auth)

### 3. Endpoints Authentifiés (Avec Middleware)

- `POST /api/s3-upload` - Upload S3
- `POST /api/video-analysis` - Analyse vidéo
- `GET /api/video-analysis/health` - Health check analyse
- `DELETE /api/videos` - Suppression vidéo
- `GET /api/video-delete/health` - Health check suppression
- `POST /api/source-videos` - Sauvegarde vidéo source
- `GET /api/source-videos` - Liste vidéos source
- `PUT /api/source-videos/:videoId` - Mise à jour vidéo source
- `POST /api/videos/generate` - Génération vidéo
- `GET /api/videos/status/:id` - Statut vidéo
- `GET /api/videos` - Liste vidéos utilisateur
- `GET /api/scripts` - Liste scripts
- `GET /api/scripts/:id` - Détail script
- `POST /api/scripts/chat` - Chat script
- `POST /api/scripts/:id/validate` - Validation script
- `DELETE /api/scripts/:id` - Suppression script
- `POST /api/scripts/:id/duplicate` - Duplication script
- `POST /api/scripts/generate-video/:id` - Génération vidéo depuis script
- `POST /api/scripts/modify-current-script/:id` - Modification script
- `POST /api/prompts/*` - Endpoints prompts
- `POST /api/voice-clone/*` - Endpoints voice clone
- `POST /api/onboarding/*` - Endpoints onboarding
- `POST /api/support/*` - Endpoints support
- `POST /api/user-management/*` - Endpoints gestion utilisateur

## 🔧 Avantages du Refactoring

### 1. Code Plus Propre

- **Avant :** Authentification manuelle dans chaque handler
- **Après :** Middleware centralisé, handlers simplifiés

### 2. Maintenance Facilitée

- **Avant :** Modifier l'auth = modifier tous les handlers
- **Après :** Modifier l'auth = modifier le middleware uniquement

### 3. Cohérence

- **Avant :** Chaque handler gère l'auth différemment
- **Après :** Comportement uniforme pour tous les endpoints

### 4. Sécurité Renforcée

- **Avant :** Risque d'oublier l'auth dans un handler
- **Après :** Impossible d'oublier l'auth sur les routes protégées

### 5. Performance

- **Avant :** Vérification JWT dans chaque handler
- **Après :** Vérification JWT une seule fois par middleware

## 🧪 Tests de Validation

```bash
# Test endpoint public
curl http://localhost:3000/api/health
# ✅ Réponse: {"success":true,"message":"API is healthy"}

# Test endpoint protégé sans token
curl http://localhost:3000/api/videos
# ✅ Réponse: {"success":false,"error":"Missing authorization header","status":401}

# Test endpoint auth-test sans token
curl http://localhost:3000/api/auth-test
# ✅ Réponse: {"success":false,"error":"No Authorization header provided"}
```

## 📋 Checklist de Validation

- [x] Serveur démarre sans erreur
- [x] Endpoints publics fonctionnent sans authentification
- [x] Endpoints protégés rejettent les requêtes sans token
- [x] Middleware d'editia-core fonctionne correctement
- [x] Aucun breaking change détecté
- [x] Code plus maintenable et lisible

## 🔄 Migration des Handlers

### Exemple de Migration

**Avant :**

```typescript
apiRouter.get("/videos", async (req, res) => {
  // Authentification manuelle
  const authHeader = req.headers.authorization;
  const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(
    authHeader
  );
  if (authError) return res.status(authError.status).json(authError);

  // Logique métier
  const userId = user!.id;
  // ...
});
```

**Après :**

```typescript
authRoutes.get("/videos", async (req, res) => {
  // req.user est déjà disponible grâce au middleware
  const userId = req.user!.id;

  // Logique métier (simplifiée)
  // ...
});
```

## 🎯 Prochaines Étapes

1. **Nettoyage :** Supprimer les imports inutilisés de `ClerkAuthService` dans les handlers
2. **Optimisation :** Vérifier si certains handlers peuvent être simplifiés
3. **Documentation :** Mettre à jour la documentation API
4. **Tests :** Ajouter des tests unitaires pour le middleware

## 📝 Notes Importantes

- Le middleware `authenticateUser` d'editia-core ajoute `req.user` à la requête
- Les endpoints publics restent accessibles sans authentification
- Les webhooks sont considérés comme publics (pas d'auth requise)
- Le refactoring est rétrocompatible (même comportement API)
