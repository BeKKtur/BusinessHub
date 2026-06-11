export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; full_name: string | null; role: ProfileRole; blocked: boolean; created_at: string };
        Insert: { id: string; email: string; full_name?: string | null; role?: ProfileRole; blocked?: boolean; created_at?: string };
        Update: { email?: string; full_name?: string | null; role?: ProfileRole; blocked?: boolean };
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
          served_counted_at: string | null;
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
          served_counted_at?: string | null;
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
          status: AppointmentStatus;
          notes: string | null;
          usage_counted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          client_id: string;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status?: AppointmentStatus;
          notes?: string | null;
          usage_counted_at?: string | null;
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
        Row: {
          id: string;
          business_id: string;
          user_id: string | null;
          plan: "free" | "pro" | "business";
          status: string;
          paddle_id: string | null;
          paddle_subscription_id: string | null;
          paddle_customer_id: string | null;
          paddle_price_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          next_billed_at: string | null;
          trial_ends_at: string | null;
          cancelled_at: string | null;
          portal_url: string | null;
          served_clients_count: number;
          completed_appointments_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id?: string | null;
          plan?: "free" | "pro" | "business";
          status?: string;
          paddle_id?: string | null;
          paddle_subscription_id?: string | null;
          paddle_customer_id?: string | null;
          paddle_price_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          next_billed_at?: string | null;
          trial_ends_at?: string | null;
          cancelled_at?: string | null;
          portal_url?: string | null;
          served_clients_count?: number;
          completed_appointments_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          plan?: "free" | "pro" | "business";
          status?: string;
          paddle_id?: string | null;
          paddle_subscription_id?: string | null;
          paddle_customer_id?: string | null;
          paddle_price_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          next_billed_at?: string | null;
          trial_ends_at?: string | null;
          cancelled_at?: string | null;
          portal_url?: string | null;
          served_clients_count?: number;
          completed_appointments_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          business_id: string;
          subscription_id: string | null;
          amount: number;
          currency: string;
          paddle_transaction_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          subscription_id?: string | null;
          amount: number;
          currency?: string;
          paddle_transaction_id: string;
          status?: string;
          created_at?: string;
        };
        Update: { subscription_id?: string | null; amount?: number; currency?: string; paddle_transaction_id?: string; status?: string };
        Relationships: [];
      };
      notifications: {
        Row: { id: string; business_id: string; channel: "telegram" | "email"; type: string; status: string; payload: Json; created_at: string };
        Insert: { id?: string; business_id: string; channel: "telegram" | "email"; type: string; status?: string; payload?: Json; created_at?: string };
        Update: { channel?: "telegram" | "email"; type?: string; status?: string; payload?: Json };
        Relationships: [];
      };
      admin_activity_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          target_user_id: string | null;
          action: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          target_user_id?: string | null;
          action: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          actor_id?: string | null;
          target_user_id?: string | null;
          action?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      profile_role: ProfileRole;
      appointment_status: AppointmentStatus;
      plan_type: "free" | "pro" | "business";
      notification_channel: "telegram" | "email";
    };
    CompositeTypes: Record<string, never>;
  };
};

type MoneyRow = {
  id: string;
  business_id: string;
  appointment_id: string | null;
  amount: number;
  category: string;
  description: string | null;
  occurred_at: string;
  created_at: string;
};

type MoneyInsert = {
  id?: string;
  business_id: string;
  appointment_id?: string | null;
  amount: number;
  category: string;
  description?: string | null;
  occurred_at: string;
  created_at?: string;
};

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type ProfileRole = "user" | "admin" | "super_admin";
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type Revenue = Database["public"]["Tables"]["revenues"]["Row"];
