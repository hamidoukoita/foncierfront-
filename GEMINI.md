# Instructions Projet : Foncier+ (Interface Web / Desktop Admin Société & Agent)

## 1. Contexte & Modèle Métier de Référence
Plateforme de promotion immobilière et d'aménagement foncier agréé au Mali (modèle d'excellence type SEMA SA, SIFMA, ACI).
- **Problématique résolue** : Zéro litige foncier, sécurisation par Titres Fonciers (TF Mère et TF Individuels), lotissements réguliers et viabilisés (VRD : eau SOMAPEP, électricité EDM, voirie, assainissement).
- **Modèle économique dual** :
  1. Portefeuille multi-cités et programmes groupés (plans de masse interactifs découpés en lots viabilisés et logements clés en main).
  2. Stock diffus de parcelles individuelles viabilisées avec TF direct garanti.
  3. Prestation clé "Construire sur mon terrain" (formule sur plan et devis échelonné).

## 2. Périmètre de cette Application (`angular-admin-societe-web`)
Cette application Angular couvre le volet Web/Desktop B2B pour les acteurs de la société promotrice agréée :
1. **Dashboard Société / Direction** :
  - Utilisé par l'**Agent Promoteur Responsable** (`AgentPromoteur`, `estResponsableSociete = true`).
  - Gestion et téléversement du dossier KYC PDF consolidé (`documentKycUrl` : Agrément ministériel, NIF, RCCM, CNI).
  - Gestion du catalogue : création de cités, gestion des plans de masse, parcelles individuelles, modèles de villas et commodités de proximité géolocalisées avec distances en km (`distance_km`).
  - Administration des collaborateurs : création des comptes d'accès pour les agents collaborateurs (`estResponsableSociete = false`).
  - Réception et **dispatching / assignation** des demandes entrantes (visites et réservations) vers des agents collaborateurs spécifiques (Agent 1, Agent 2...).
  - Pouvoir d'auto-régulation : suspension immédiate d'un lot contesté au statut `INDISPONIBLE_LITIGE`.
2. **Dashboard Agent Collaborateur (Desktop)** :
  - Utilisé par l'**Agent Collaborateur** (`estResponsableSociete = false`).
  - Consultation des demandes de visites (au siège ou sur chantier) et réservations assignées.
  - Suivi du statut des dossiers et mise à jour des lots (bascule au statut `Réservé 🟡` suite à validation prospect).
3. **Spécificité V1** :
  - **Pas de paiement en ligne** (mobile money ou bancaire) ni de signature d'acte dans cette version (conclus physiquement au siège ou devant notaire).

## 3. Statuts Métier et Règles de Gestion
- **Statuts d'agrément KYC** : `EN_ATTENTE_VALIDATION`, `VALIDE_MINISTERE`, `REJETE`. Aucune publication possible sans validation par l'administrateur.
- **Statuts couleur dynamiques des lots (Plan de masse)** :
  - 🟢 **DISPONIBLE** : Libre à la réservation.
  - 🟡 **RESERVE** : Option posée en cours d'instruction par un agent.
  - 🔴 **VENDU** : Définitivement acté chez le notaire.
  - ⚫ / ⚠️ **INDISPONIBLE_LITIGE** : Gelé immédiatement par le promoteur ou l'administrateur.
- **Commodités** : Toujours associées à un type (École, CSCOM/Hôpital, Marché, Mosquée, Sécurité, Transport) et une distance en km (`distance_km`).

## 4. Stack Technique & Standards Frontend
- **Framework** : Angular (version moderne 17+ / 19+).
- **Architecture des Composants** :
  - **100% Standalone Components** (`standalone: true`). Aucun `NgModule` traditionnel.
  - Gestion d'état et réactivité : **Angular Signals** (`signal()`, `computed()`, `effect()`) et nouvelle syntaxe de flux de contrôle dans les templates (`@if`, `@for`, `@switch`).
  - Formulaires : **ReactiveFormsModule** avec validation stricte.
- **Styling** :
  - **Tailwind CSS** exclusif pour la mise en page et les composants UI.
  - Design professionnel, épuré, adapté à un tableau de bord B2B moderne (cartes, badges de statuts aux couleurs du cahier des charges, modales ergonomiques).
- **Communication API & Intégration Backend** :
  - Backend cible : Spring Boot 3 (`Foncierback`), sécurisé par JWT.
  - Intercepteur HTTP pour injecter le token Bearer Authorization et intercepter les erreurs 401/403.
  - Typage strict TypeScript (`models/` ou `interfaces/`), **strictement aucun type `any`**.

## 5. Organisation des Dossiers Suggérée
```text
src/app/
├── core/                  # Services uniques, intercepteurs HTTP, guards d'authentification
├── shared/                # Composants réutilisables (boutons, tables, modales, badges de statut)
├── features/
│   ├── auth/              # Connexion, inscription responsable promoteur, upload KYC
│   ├── dashboard/         # Vue synthétique (KPIs, alertes litiges, flux récents)
│   ├── programmes/        # Gestion cités, parcelles individuelles, plans de masse SVG
│   ├── agents/            # Gestion des collaborateurs par le responsable
│   ├── reservations/      # Liste des réservations, dispatching et assignation
│   ├── visites/           # Calendrier des RDV (Siège / Chantier) et assignation
│   └── construire/        # Suivi des dossiers "Construire sur mon terrain"
└── models/                # Interfaces TypeScript reflétant le modèle Spring Boot / MySQL
