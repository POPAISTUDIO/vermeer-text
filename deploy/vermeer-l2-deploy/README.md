# Package de déploiement L2 — interpréteur de code

Manifests Kubernetes (DRAFT, à relire/déployer par Oussama après la release V1) pour activer l'agent L2 « interpréteur de code » sur le cluster : interpréteur LibreCodeInterpreter (sandboxes nsjail) + Redis + stockage S3 (MinIO in-cluster par défaut), durcis et étanches par NetworkPolicy.

Voir [k8s/](k8s/) pour les manifests et le README détaillé (rôle de chaque fichier, choix de durcissement, câblage LibreChat, décisions ouvertes). Tous les secrets sont par référence SSM via `externalsecret.yaml` — aucune valeur en clair.
