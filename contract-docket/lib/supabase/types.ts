export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ContractRow = {
  id: string;
  owner_id: string;
  data: Json;
  status: string;
  token_hash: string | null;
  expires_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      contracts: {
        Row: ContractRow;
        Insert: {
          id: string;
          owner_id: string;
          data: Json;
          status: string;
          token_hash?: string | null;
          expires_at?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          data?: Json;
          status?: string;
          token_hash?: string | null;
          expires_at?: string | null;
          version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
