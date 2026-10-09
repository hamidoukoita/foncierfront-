import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/guards/auth.guard';
import { adminPlatformGuard, promoteurResponsableGuard } from './core/guards/role.guard';
import { kycValideGuard } from './core/guards/kyc-valide.guard';
import { AdminLayoutComponent } from './layout/admin-layout/admin-layout.component';

export const routes: Routes = [
  // --- AUTHENTIFICATION ---
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [noAuthGuard],
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./features/auth/register-societe/register-societe.component').then(
        (m) => m.RegisterSocieteComponent,
      ),
    canActivate: [noAuthGuard],
  },
  {
    path: 'login',
    redirectTo: '/auth/login',
    pathMatch: 'full',
  },
  {
    path: 'register',
    redirectTo: '/auth/register',
    pathMatch: 'full',
  },
  {
    path: 'inscription',
    redirectTo: '/auth/register',
    pathMatch: 'full',
  },
  {
    path: 'access-denied',
    loadComponent: () =>
      import('./features/auth/access-denied/access-denied.component').then(
        (m) => m.AccessDeniedComponent,
      ),
  },

  // --- BRANCHE 1 : CONSOLE ADMINISTRATION SOUVERAINE PLATEFORME (DNCG) ---
  // Bloqué pour tout le monde SAUF l'Administrateur Plateforme / DNCG
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard, adminPlatformGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin-dndc/super-dashboard/super-dashboard.component').then(
            (m) => m.SuperDashboardComponent,
          ),
      },
      {
        path: 'super-dashboard',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'inscriptions-societes',
        loadComponent: () =>
          import('./features/admin-dndc/inscriptions/inscriptions-societes.component').then(
            (m) => m.InscriptionsSocietesComponent,
          ),
      },
      {
        path: 'utilisateurs-roles',
        loadComponent: () =>
          import('./features/admin-dndc/utilisateurs/utilisateurs-roles.component').then(
            (m) => m.UtilisateursRolesComponent,
          ),
      },
      {
        path: 'controle-programmes',
        loadComponent: () =>
          import('./features/admin-dndc/programmes-controle/programmes-controle.component').then(
            (m) => m.ProgrammesControleComponent,
          ),
      },
    ],
  },

  // --- BRANCHE 2 : DIRECTION SOCIÉTÉ PROMOTRICE AGRÉÉE (SEMA SA, SIFMA, etc.) ---
  // Accessible UNIQUEMENT par l'Agent Promoteur Responsable (estResponsableSociete = true)
  {
    path: 'societe',
    component: AdminLayoutComponent,
    canActivate: [authGuard, promoteurResponsableGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'programmes',
        loadComponent: () =>
          import('./features/programmes/programmes.component').then((m) => m.ProgrammesComponent),
        canActivate: [kycValideGuard],
      },
      {
        path: 'programmes/:id/plan-masse',
        loadComponent: () =>
          import('./features/plan-masse-editor/plan-masse-editor.component').then(
            (m) => m.PlanMasseEditorComponent,
          ),
        canActivate: [kycValideGuard],
      },
      {
        path: 'plan-masse',
        loadComponent: () =>
          import('./features/plan-masse-editor/plan-masse-editor.component').then(
            (m) => m.PlanMasseEditorComponent,
          ),
        canActivate: [kycValideGuard],
      },
      {
        path: 'parcelles',
        loadComponent: () =>
          import('./features/parcelles/parcelles.component').then((m) => m.ParcellesComponent),
        canActivate: [kycValideGuard],
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./features/reservations/reservations.component').then(
            (m) => m.ReservationsComponent,
          ),
        canActivate: [kycValideGuard],
      },
      {
        path: 'visites',
        loadComponent: () =>
          import('./features/visites/visites.component').then((m) => m.VisitesComponent),
        canActivate: [kycValideGuard],
      },
      {
        path: 'agents',
        loadComponent: () =>
          import('./features/agents/agents.component').then((m) => m.AgentsComponent),
      },
      {
        path: 'projets-construction',
        loadComponent: () =>
          import('./features/construire/projets-construction.component').then(
            (m) => m.ProjetsConstructionComponent,
          ),
        canActivate: [kycValideGuard],
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(
            (m) => m.NotificationsComponent,
          ),
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./features/profil/profil-societe.component').then(
            (m) => m.ProfilSocieteComponent,
          ),
      },
      {
        path: 'kyc-attente',
        loadComponent: () =>
          import('./features/societe/kyc-attente/kyc-attente.component').then(
            (m) => m.KycAttenteComponent,
          ),
      },
    ],
  },

  // --- REDIRECTION INITIALE RACINE ---
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'auth/login',
  },

  // --- REDIRECTION CATCH-ALL ---
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
