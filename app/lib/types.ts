export interface Company {
  name: string;
  address: string;
  orgNr: string;
  phone: string;
  email: string;
  logo: string | null; // data URL or null
}

export interface Group {
  id: string;
  nr: number;
  description: string;
  fuse: number; // Ampere
  conductor: string; // e.g. "2.5 mm² EKK"
  phases: 1 | 3;
  lengthM?: number;
  loadA?: number;
  comment?: string;
}

export interface ServiceEntry {
  id: string;
  date: string; // ISO date
  note: string;
  performedBy?: string;
}

export interface Installation {
  id: string;
  updatedAt: string;
  customer: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  panel: {
    location: string; // Elcentralens plats/beteckning
    mainFuse: number; // Huvudsäkring A
    phases: 1 | 3;
    date: string; // ISO
    notes?: string;
  };
  groups: Group[];
  serviceLog: ServiceEntry[];
}
