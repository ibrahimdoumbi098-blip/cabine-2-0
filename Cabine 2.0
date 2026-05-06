# Dossier de Présentation Technique & Commercial : Projet "Cabine 2.0"
**Objet :** Demande de partenariat et d'accès à l'environnement de production de l'API GeniusPay.

---

## 1. Résumé Exécutif (Executive Summary)
**Cabine 2.0** est une plateforme SaaS (Software as a Service) B2B de technologie financière conçue pour révolutionner et digitaliser le secteur de la distribution de monnaie électronique en Côte d'Ivoire. Notre objectif est de transformer les points de transfert d'argent traditionnels ("cabines") en véritables hubs financiers numériques unifiés.

## 2. Le Constat (Le Problème)
Aujourd'hui, un gérant de cabine Ivoirien fait face à plusieurs défis logistiques majeurs :
*   **La fragmentation du matériel :** Nécessité de posséder et de manipuler 3 à 4 téléphones portables différents (Orange, MTN, Moov, Wave) pour servir les clients.
*   **La comptabilité archaïque :** Le suivi des transactions (le "cahier de cabine") est manuel, sujet aux erreurs humaines, aux ratures et aux vols.
*   **Les risques sécuritaires :** Manipulation constante de terminaux physiques sans sécurité logicielle renforcée pour les employés.

## 3. Notre Solution : "Cabine 2.0"
Nous avons développé une plateforme web unifiée, accessible sur mobile, tablette et ordinateur, qui agrège l'ensemble des réseaux sur une seule interface (Super-App B2B).

**Fonctionnalités clés actuelles :**
*   **Tableau de bord unique :** Le gérant possède une "Flotte Globale" (un solde unique) depuis lequel il peut dispatcher vers tous les réseaux (Orange, MTN, Moov, Wave).
*   **Grand Livre Numérique (Ledger) :** Enregistrement automatique de chaque transaction en temps réel avec son statut précis (En cours, Succès, Échec).
*   **Reçus Numériques :** Génération instantanée d'un ticket de caisse numérique (format PNG/PDF) partageable par WhatsApp ou imprimable via imprimante thermique Bluetooth.

## 4. Cas d'Usage de l'API GeniusPay
Nous sollicitons l'infrastructure de **GeniusPay** pour opérer en tant que moteur transactionnel (switch) derrière notre interface.

**Workflow de transaction (Le parcours de la donnée) :**
1. Le client physique se présente à la cabine pour un dépôt de 5.000 FCFA sur un compte MTN MoMo.
2. Le gérant saisit le numéro et le montant sur *Cabine 2.0* et valide l'opération avec son **Code PIN personnel (Sécurité)**.
3. Notre backend (Node.js/Express) déduit virtuellement le montant du solde global du gérant et passe la transaction au statut `PENDING`.
4. **Appel API GeniusPay :** Notre serveur envoie de manière sécurisée la requête de transfert vers l'API GeniusPay (`/transfers`).
5. **Webhook & Validation :** Dès réception du Webhook de succès de GeniusPay, la transaction passe au statut `SUCCESS` et le reçu numérique est débloqué. Si le Webhook indique un échec, notre système effectue un **Rollback automatique** et recrédite instantanément le solde du gérant.

## 5. Mesures de Sécurité & Conformité
En tant qu'intermédiaire technologique, nous prenons la sécurité très au sérieux :
*   **Validation par PIN :** Un clavier numérique virtuel crypté exige un code à 4 chiffres pour *chaque* tentative de transaction, protégeant contre les keyloggers et l'utilisation non autorisée du compte.
*   **Infrastructure Cloud :** L'application est hébergée sur l'infrastructure Vercel avec une base de données **PostgreSQL** relationnelle, garantissant les propriétés ACID (Atomicité, Cohérence, Isolation, Durabilité) des données financières.
*   **Idempotence :** Notre code génère des références uniques (ex: `GP-TX-TIMESTAMP`) pour éviter tout risque de double facturation en cas de coupure internet locale.

## 6. Pourquoi GeniusPay ?
Nous avons choisi d'intégrer GeniusPay car nous croyons en la synergie entre jeunes entreprises technologiques ivoiriennes. La modernité de votre API (RESTful, Webhooks), votre agilité, et votre compréhension des enjeux locaux (connexions instables, nécessité de réponses rapides) correspondent parfaitement à notre vision de l'innovation financière inclusive.

## 7. Projections & Volume Ciblé (Traction)
Pour notre phase pilote (Proof of Concept), nous prévoyons de déployer la solution auprès de **10 à 15 points de vente partenaires** dans la zone d'Abidjan. 
*   **Volume estimé / Jour / Cabine :** ~50 transactions.
*   **Volume global mensuel ciblé (Phase 1) :** ~20.000 transactions traitées via l'API GeniusPay.

Nous sommes à votre entière disposition pour une démonstration technique de notre plateforme (déjà déployée et fonctionnelle en environnement de test) et pour finaliser nos procédures KYC afin d'obtenir nos accès de production.

---
*Document rédigé par la Direction Technique (CTO) de Cabine 2.0.*
