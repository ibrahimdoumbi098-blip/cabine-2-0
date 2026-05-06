---
name: dashboard
description: '**COMPÉTENCE DE WORKFLOW** — Construire un tableau de bord d'analyses et de gestion pour la plateforme fintech Cabine 2.0. UTILISER POUR : créer des panneaux KPI, analyses de transactions, vues de performances des opérateurs, et fonctionnalités de reporting dans le frontend React. INVOQUE : outils système de fichiers pour la création de composants, run_in_terminal pour les builds et tests, sous-agents pour l'exploration du code. NE PAS UTILISER POUR : développement React général, fonctionnalités backend uniquement, ou composants UI non-tableau de bord.'
---

# Générateur de Tableau de Bord Cabine 2.0

## Aperçu du Workflow

Cette compétence guide à travers la construction d'un tableau de bord d'analyses complet pour la plateforme Cabine 2.0, incluant les KPI en temps réel, la gestion des transactions, les performances des opérateurs, et les capacités de reporting.

## Processus Étape par Étape

### 1. Évaluer l'État Actuel du Tableau de Bord
- Explorer les composants de graphiques existants (BarChart, DonutChart, HourlyHeatmap) dans le répertoire src/
- Examiner les points de terminaison API dans server.js et api/index.js pour les données disponibles
- Identifier les éléments UI du tableau de bord existants et les sources de données
- Déterminer quelles données d'analyses sont déjà disponibles vs. ce qui nécessite de nouvelles routes backend

### 2. Planifier les Fonctionnalités du Tableau de Bord
- Définir les indicateurs clés de performance (KPI) : volume des transactions quotidiennes, taux de succès, commissions gagnées, performances des opérateurs
- Concevoir la mise en page UI : cartes KPI, graphiques de séries temporelles, panneaux de filtrage, vues de comparaison des opérateurs
- Spécifier les exigences de données et les besoins d'agrégation
- Planifier la structure des composants et la gestion d'état

### 3. Implémenter les Composants Core du Tableau de Bord
- Créer le composant de cartes de résumé KPI
- Construire des composants de graphiques améliorés pour les données de séries temporelles
- Ajouter un sélecteur de plage de dates et des contrôles de filtrage
- Implémenter des vues de répartition des performances des opérateurs
- Créer l'interface de surveillance du statut des transactions

### 4. Intégrer les Données Backend
- Ajouter de nouvelles routes API pour les données d'analyses (/api/stats, /api/analytics)
- Implémenter la logique d'agrégation de données dans le backend
- Assurer une gestion d'erreur appropriée et des états de chargement
- Ajouter des optimisations de requêtes de base de données pour les performances

### 5. Ajouter des Fonctionnalités Avancées
- Implémenter la recherche de transactions et le filtrage avancé
- Créer la fonctionnalité d'export PDF/CSV pour les rapports
- Ajouter des mises à jour en temps réel via polling ou websockets
- Implémenter l'intelligence des soldes de portefeuille et les alertes

### 6. Test et Finition
- Tester le tableau de bord avec divers scénarios de données
- Assurer une conception responsive et une compatibilité mobile
- Ajouter des états de chargement et des limites d'erreur
- Valider les performances avec de grands ensembles de données

## Contrôles de Qualité
- Le tableau de bord se charge en moins de 3 secondes
- Tous les graphiques se rendent correctement avec des données d'exemple
- Le filtrage et la recherche fonctionnent avec précision
- Les fonctionnalités d'export génèrent des fichiers corrects
- La mise en page mobile est fonctionnelle

## Outils et Ressources
- Utilise des composants React dans src/
- Tire parti des bibliothèques de graphiques existantes
- S'intègre avec les routes API Express
- Suit les patterns de style CSS du projet

## Quality Checks
- Dashboard loads within 3 seconds
- All charts render correctly with sample data
- Filtering and search work accurately
- Export features generate correct files
- Mobile layout is functional

## Tools and Assets
- Uses React components in src/
- Leverages existing chart libraries
- Integrates with Express API routes
- Follows project's CSS styling patterns