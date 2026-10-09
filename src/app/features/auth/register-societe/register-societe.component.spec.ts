import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RegisterSocieteComponent } from './register-societe.component';
import { AuthService } from '../../../core/services/auth.service';
import { of } from 'rxjs';
import { ApiResponse, RegisterSocieteResponse } from '../../../core/models/auth.models';

describe('RegisterSocieteComponent - Formulaire Slide par Slide d\'adhésion Société', () => {
  let component: RegisterSocieteComponent;
  let fixture: ComponentFixture<RegisterSocieteComponent>;
  let authService: { registerSociete: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      registerSociete: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [RegisterSocieteComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterSocieteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait créer le composant d\'inscription sur le premier slide', () => {
    expect(component).toBeTruthy();
    expect(component.currentStep()).toBe(1);
    expect(component.totalSteps).toBe(4);
  });

  it('devrait bloquer le passage au slide 2 si les champs obligatoires du slide 1 ne sont pas renseignés', () => {
    component.nextStep();
    expect(component.currentStep()).toBe(1);
    expect(component.errorMessage()).toContain('Veuillez renseigner tous les champs obligatoires');
  });

  it('devrait passer au slide 2 quand le slide 1 (Société) est valide', () => {
    component.form.patchValue({
      nomSociete: 'SEMA SA Test',
      formeJuridique: 'SA',
      adresse: 'Hamdallaye ACI 2000, Bamako',
      telephoneSociete: '20220000'
    });

    component.nextStep();
    expect(component.currentStep()).toBe(2);
    expect(component.errorMessage()).toBeNull();
  });

  it('devrait permettre de revenir au slide précédent', () => {
    component.form.patchValue({
      nomSociete: 'SEMA SA Test',
      formeJuridique: 'SA',
      adresse: 'Hamdallaye ACI 2000, Bamako',
      telephoneSociete: '20220000'
    });

    component.nextStep();
    expect(component.currentStep()).toBe(2);

    component.prevStep();
    expect(component.currentStep()).toBe(1);
  });

  it('devrait passer au slide 5 (écran de confirmation) après soumission réussie', () => {
    const mockResponse: ApiResponse<RegisterSocieteResponse> = {
      success: true,
      message: 'Société enregistrée avec succès',
      data: {
        id: 99,
        nomCommercial: 'SEMA SA Test',
        numeroAgrement: 'AGR-2024-TEST',
        statutAgrement: 'EN_ATTENTE_VALIDATION',
        email: 'contact@sema.ml',
        telephone: '20220000'
      }
    };

    authService.registerSociete.mockReturnValue(of(mockResponse));

    component.form.patchValue({
      nomSociete: 'SEMA SA Test',
      formeJuridique: 'SA',
      adresse: 'Hamdallaye ACI 2000, Bamako',
      telephoneSociete: '20220000',
      numeroAgrement: 'AGR-2024-TEST',
      dateAgrement: '2024-01-15',
      nif: '0801234567M',
      prenomResponsable: 'Oumar',
      nomResponsable: 'DIARRA',
      telephoneResponsable: '76000000',
      motDePasse: 'SecretPass123',
      confirmerMotDePasse: 'SecretPass123',
      engagementHonneur: true
    });

    component.currentStep.set(4);
    component.onSubmit();

    expect(authService.registerSociete).toHaveBeenCalled();
    expect(component.currentStep()).toBe(5);
  });
});
