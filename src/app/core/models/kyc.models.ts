export enum TypeDocumentKyc {
  NIF = 'NIF',
  RCCM = 'RCCM',
  AGREMENT_MINISTERIEL = 'AGREMENT_MINISTERIEL',
  ATTESTATION_FISCALE = 'ATTESTATION_FISCALE'
}

export interface DocumentKycResponse {
  id: number;
  nomOriginal: string;
  typeDocument: TypeDocumentKyc;
  tailleFichier: number;
  dateAjout: string;
  urlPreview: string;
}

export interface DossierKycStatusResponse {
  statutAgrement: string;
  documents: DocumentKycResponse[];
}
