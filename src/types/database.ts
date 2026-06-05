export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; full_name: string | null; role: "owner" | "admin"; created_at: string };
        Insert: { id: string; email: string; full_name?: string | null; role?: "owner" | "admin"; created_at?: string };
        Update: { email?: string; full_name?: string | null; role?: "owner" | "admin" };
        Relationships: [];
      };
      businesses: {
        Row: { id: string; owner_id: string; name: string; type: string; timezone: string; created_at: string };
        Insert: { id?: string; owner_id: string; name: string; type: string; timezone?: string; created_at?: string };
        Update: { name?: string; type?: string; timezone?: string };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          phone: string;
          email: string | null;
          notes: string | null;
          telegram: string | null;
          visits_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          phone: string;
          email?: string | null;
          notes?: string | null;
          telegram?: string | null;
          visits_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          business_id: string;
          client_id: string;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status: "scheduled" | "completed" | "cancelled" | "rescheduled";
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          client_id: string;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status?: "scheduled" | "completed" | "cancelled" | "rescheduled";
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          category: string;
          description: string | null;
          price: number;
          duration_minutes: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          category: string;
          description?: string | null;
          price: number;
          duration_minutes: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
        Relationships: [];
      };
      expenses: { Row: MoneyRow; Insert: MoneyInsert; Update: Partial<MoneyInsert>; Relationships: [] };
      revenues: { Row: MoneyRow; Insert: MoneyInsert; Update: Partial<MoneyInsert>; Relationships: [] };
      subscriptions: {
        Row: { id: string; business_id: string; plan: "free" | "pro" | "business"; status: string; paddle_id: string | null };
        Insert: { id?: string; business_id: string; plan?: "free" | "pro" | "business"; status?: string; paddle_id?: string | null };
        Update: { plan?: "free" | "pro" | "business"; status?: string; paddle_id?: string | null };
        Relationships: [];
      };
      payments: {
        Row: { id: string; business_id: string; amount: number; currency: string; paddle_transaction_id: string; created_at: string };
        Insert: { id?: string; business_id: string; amount: number; currency?: string; paddle_transaction_id: string; created_at?: string };
        Update: { amount?: number; currency?: string; paddle_transaction_id?: string };
        Relationships: [];
      };
      notifications: {
        Row: { id: string; business_id: string; channel: "telegram" | "email"; type: string; status: string; payload: Json; created_at: string };
        Insert: { id?: string; business_id: string; channel: "telegram" | "email"; type: string; status?: string; payload?: Json; created_at?: string };
        Update: { channel?: "telegram" | "email"; type?: string; status?: string; payload?: Json };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      profile_role: "owner" | "admin";
      appointment_status: "scheduled" | "completed" | "cancelled" | "rescheduled";
      plan_type: "free" | "pro" | "business";
      notification_channel: "telegram" | "email";
    };
    CompositeTypes: Record<string, never>;
  };
};

type MoneyRow = {
  id: string;
  business_id: string;
  amount: number;
  category: string;
  description: string | null;
  occurred_at: string;
  created_at: string;
};

type MoneyInsert = {
  id?: string;
  business_id: string;
  amount: number;
  category: string;
  description?: string | null;
  occurred_at: string;
  created_at?: string;
};

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
