import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KycService } from '../../../core/services/kyc.service';
import { TypeDocumentKyc } from '../../../core/models/kyc.models';

@Component({
  selector: 'app-kyc-attente',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kyc-attente.component.html',
  styleUrls: ['./kyc-attente.component.css']
})
export class KycAttenteComponent implements OnInit {
  private kycService = inject(KycService);
  
  statut = signal<string>('CHARGEMENT');
  documents = signal<any[]>([]);
  
  // Types requis
  requiredTypes = [TypeDocumentKyc.NIF, TypeDocumentKyc.RCCM, TypeDocumentKyc.AGREMENT_MINISTERIEL];
  optionalTypes = [TypeDocumentKyc.ATTESTATION_FISCALE];
  
  TypeDocumentKyc = TypeDocumentKyc; // pour le template

  ngOnInit(): void {
    this.loadStatut();
  }

  loadStatut() {
    this.kycService.getStatut().subscribe({
      next: (res) => {
        this.statut.set(res.statutAgrement);
        this.documents.set(res.documents);
      },
      error: () => {
        this.statut.set('ERREUR');
      }
    });
  }

  hasDocument(type: TypeDocumentKyc): boolean {
    return this.documents().some(d => d.typeDocument === type);
  }

  onFileSelected(event: any, type: TypeDocumentKyc) {
    const file = event.target.files[0];
    if (file) {
      this.kycService.uploadDocument(file, type).subscribe({
        next: () => {
          this.loadStatut();
        },
        error: (err) => {
          alert("Erreur lors de l'upload : " + err.message);
        }
      });
    }
  }

  soumettre() {
    const missingRequired = this.requiredTypes.filter(t => !this.hasDocument(t));
    if (missingRequired.length > 0) {
      alert("Veuillez uploader tous les documents obligatoires avant de soumettre.");
      return;
    }

    this.kycService.soumettreDossier().subscribe({
      next: () => {
        this.loadStatut();
        alert("Dossier soumis avec succès !");
      },
      error: (err) => {
        alert("Erreur lors de la soumission : " + err.message);
      }
    });
  }

  getLabel(type: TypeDocumentKyc): string {
    switch (type) {
      case TypeDocumentKyc.NIF: return "Numéro d'Identification Fiscale (NIF)";
      case TypeDocumentKyc.RCCM: return "Registre du Commerce (RCCM)";
      case TypeDocumentKyc.AGREMENT_MINISTERIEL: return "Arrêté d'Agrément Ministériel";
      case TypeDocumentKyc.ATTESTATION_FISCALE: return "Attestation Fiscale de Régularité";
      default: return type;
    }
  }
}
