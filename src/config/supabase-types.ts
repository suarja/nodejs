export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          audience_profile: string | null
          created_at: string | null
          error_message: string | null
          id: string
          last_scraped_at: string | null
          niche: string | null
          profile_pic_url: string | null
          status: string | null
          tiktok_handle: string
          updated_at: string | null
          user_id: string | null
          username: string | null
          videos_ids: string[] | null
        }
        Insert: {
          audience_profile?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_scraped_at?: string | null
          niche?: string | null
          profile_pic_url?: string | null
          status?: string | null
          tiktok_handle: string
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
          videos_ids?: string[] | null
        }
        Update: {
          audience_profile?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_scraped_at?: string | null
          niche?: string | null
          profile_pic_url?: string | null
          status?: string | null
          tiktok_handle?: string
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
          videos_ids?: string[] | null
        }
        Relationships: []
      }
      accounts_aggregates: {
        Row: {
          account_id: string
          avg_comments: number | null
          avg_likes: number | null
          avg_shares: number | null
          avg_views: number | null
          best_posting_time: string | null
          hashtag_diversity: number | null
          id: string
          last_updated: string
          music_usage_stats: Json | null
          posting_frequency_weekly: number | null
          sponsored_ratio: number | null
          top_hashtags: string[] | null
          top_videos: Json | null
          video_length_distribution: Json | null
        }
        Insert: {
          account_id: string
          avg_comments?: number | null
          avg_likes?: number | null
          avg_shares?: number | null
          avg_views?: number | null
          best_posting_time?: string | null
          hashtag_diversity?: number | null
          id?: string
          last_updated?: string
          music_usage_stats?: Json | null
          posting_frequency_weekly?: number | null
          sponsored_ratio?: number | null
          top_hashtags?: string[] | null
          top_videos?: Json | null
          video_length_distribution?: Json | null
        }
        Update: {
          account_id?: string
          avg_comments?: number | null
          avg_likes?: number | null
          avg_shares?: number | null
          avg_views?: number | null
          best_posting_time?: string | null
          hashtag_diversity?: number | null
          id?: string
          last_updated?: string
          music_usage_stats?: Json | null
          posting_frequency_weekly?: number | null
          sponsored_ratio?: number | null
          top_hashtags?: string[] | null
          top_videos?: Json | null
          video_length_distribution?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_aggregates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_llm_insights: {
        Row: {
          account_id: string
          content_analysis: Json | null
          created_at: string
          id: string
          performance_insights: Json | null
          profile_summary: Json | null
          recommendations: Json | null
          run_id: string
          user_id: string
          version: string | null
        }
        Insert: {
          account_id: string
          content_analysis?: Json | null
          created_at?: string
          id?: string
          performance_insights?: Json | null
          profile_summary?: Json | null
          recommendations?: Json | null
          run_id: string
          user_id: string
          version?: string | null
        }
        Update: {
          account_id?: string
          content_analysis?: Json | null
          created_at?: string
          id?: string
          performance_insights?: Json | null
          profile_summary?: Json | null
          recommendations?: Json | null
          run_id?: string
          user_id?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_llm_insights_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_llm_insights_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_llm_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_stats: {
        Row: {
          account_id: string
          engagement_rate: number | null
          followers_count: number | null
          following_count: number | null
          id: string
          likes_count: number | null
          snapshot_date: string | null
          videos_count: number | null
        }
        Insert: {
          account_id: string
          engagement_rate?: number | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          likes_count?: number | null
          snapshot_date?: string | null
          videos_count?: number | null
        }
        Update: {
          account_id?: string
          engagement_rate?: number | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          likes_count?: number | null
          snapshot_date?: string | null
          videos_count?: number | null
        }
        Relationships: []
      }
      analyses: {
        Row: {
          account_id: string
          analysis_data: Json | null
          analysis_date: string | null
          created_at: string | null
          error_message: string | null
          id: string
          insights_json: Json | null
          llm_output: string | null
          model_version: string | null
          processing_time_ms: number | null
          quality_score: number | null
          run_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          analysis_data?: Json | null
          analysis_date?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          insights_json?: Json | null
          llm_output?: string | null
          model_version?: string | null
          processing_time_ms?: number | null
          quality_score?: number | null
          run_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          analysis_data?: Json | null
          analysis_date?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          insights_json?: Json | null
          llm_output?: string | null
          model_version?: string | null
          processing_time_ms?: number | null
          quality_score?: number | null
          run_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_profiles: {
        Row: {
          audience: string | null
          content_examples: Json | null
          created_at: string | null
          id: string
          persona_description: string | null
          style_notes: string | null
          tone_of_voice: string | null
          user_id: string | null
        }
        Insert: {
          audience?: string | null
          content_examples?: Json | null
          created_at?: string | null
          id?: string
          persona_description?: string | null
          style_notes?: string | null
          tone_of_voice?: string | null
          user_id?: string | null
        }
        Update: {
          audience?: string | null
          content_examples?: Json | null
          created_at?: string | null
          id?: string
          persona_description?: string | null
          style_notes?: string | null
          tone_of_voice?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "editorial_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          required_plan: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: string
          is_active?: boolean | null
          name: string
          required_plan?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          required_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_required_plan_fkey"
            columns: ["required_plan"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      gemini_outputs: {
        Row: {
          analysis_date: string | null
          error_message: string | null
          gemini_output: Json | null
          id: string
          run_id: string
          status: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          analysis_date?: string | null
          error_message?: string | null
          gemini_output?: Json | null
          id?: string
          run_id: string
          status?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          analysis_date?: string | null
          error_message?: string | null
          gemini_output?: Json | null
          id?: string
          run_id?: string
          status?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_survey: {
        Row: {
          content_frequency: string | null
          content_goals: string
          content_style: string
          created_at: string
          editorial_profile: string | null
          id: number
          pain_points: string
          platform_focus: string | null
          user_id: string | null
        }
        Insert: {
          content_frequency?: string | null
          content_goals: string
          content_style: string
          created_at?: string
          editorial_profile?: string | null
          id?: number
          pain_points: string
          platform_focus?: string | null
          user_id?: string | null
        }
        Update: {
          content_frequency?: string | null
          content_goals?: string
          content_style?: string
          created_at?: string
          editorial_profile?: string | null
          id?: number
          pain_points?: string
          platform_focus?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_eur: number | null
          created_at: string | null
          id: string
          plan: string | null
          status: string | null
          stripe_payment_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_eur?: number | null
          created_at?: string | null
          id?: string
          plan?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_eur?: number | null
          created_at?: string | null
          id?: string
          plan?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: number
          user_id: string
          username: string
        }
        Insert: {
          id?: never
          user_id?: string
          username: string
        }
        Update: {
          id?: never
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      prompt_metrics: {
        Row: {
          account_id: string | null
          created_at: string | null
          error_message: string | null
          error_type: string | null
          id: string
          input_size_chars: number | null
          model_used: string
          output_size_chars: number | null
          parsing_success: boolean
          prompt_id: string
          prompt_version: string
          quality_score: number | null
          response_time_ms: number
          retry_count: number | null
          run_id: string | null
          stage: string
          subscription_tier: string | null
          success: boolean
          token_usage: Json | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          id?: string
          input_size_chars?: number | null
          model_used: string
          output_size_chars?: number | null
          parsing_success?: boolean
          prompt_id: string
          prompt_version: string
          quality_score?: number | null
          response_time_ms: number
          retry_count?: number | null
          run_id?: string | null
          stage: string
          subscription_tier?: string | null
          success?: boolean
          token_usage?: Json | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          id?: string
          input_size_chars?: number | null
          model_used?: string
          output_size_chars?: number | null
          parsing_success?: boolean
          prompt_id?: string
          prompt_version?: string
          quality_score?: number | null
          response_time_ms?: number
          retry_count?: number | null
          run_id?: string | null
          stage?: string
          subscription_tier?: string | null
          success?: boolean
          token_usage?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_metrics_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      rl_training_data: {
        Row: {
          created_at: string | null
          creatomate_template: Json
          feedback_notes: string | null
          feedback_score: number | null
          generated_script: string
          id: string
          performance_metrics: Json | null
          raw_prompt: string
          user_id: string | null
          video_request_id: string | null
        }
        Insert: {
          created_at?: string | null
          creatomate_template: Json
          feedback_notes?: string | null
          feedback_score?: number | null
          generated_script: string
          id?: string
          performance_metrics?: Json | null
          raw_prompt: string
          user_id?: string | null
          video_request_id?: string | null
        }
        Update: {
          created_at?: string | null
          creatomate_template?: Json
          feedback_notes?: string | null
          feedback_score?: number | null
          generated_script?: string
          id?: string
          performance_metrics?: Json | null
          raw_prompt?: string
          user_id?: string | null
          video_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rl_training_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rl_training_data_video_request_id_fkey"
            columns: ["video_request_id"]
            isOneToOne: false
            referencedRelation: "video_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          account_id: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          job_id: string | null
          job_type: string
          logs: Json | null
          parent_job_id: string | null
          progress: number | null
          started_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string | null
          job_type: string
          logs?: Json | null
          parent_job_id?: string | null
          progress?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string | null
          job_type?: string
          logs?: Json | null
          parent_job_id?: string | null
          progress?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      script_drafts: {
        Row: {
          created_at: string
          current_script: string
          editorial_profile_id: string | null
          estimated_duration: number
          id: string
          message_count: number
          messages: Json
          output_language: string
          status: string
          title: string
          updated_at: string
          user_id: string
          version: number
          word_count: number
        }
        Insert: {
          created_at?: string
          current_script?: string
          editorial_profile_id?: string | null
          estimated_duration?: number
          id?: string
          message_count?: number
          messages?: Json
          output_language?: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          version?: number
          word_count?: number
        }
        Update: {
          created_at?: string
          current_script?: string
          editorial_profile_id?: string | null
          estimated_duration?: number
          id?: string
          message_count?: number
          messages?: Json
          output_language?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "script_drafts_editorial_profile_id_fkey"
            columns: ["editorial_profile_id"]
            isOneToOne: false
            referencedRelation: "editorial_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          created_at: string | null
          generated_script: string | null
          id: string
          output_language: string | null
          raw_prompt: string | null
          review_notes: string | null
          status: string | null
          user_id: string | null
          video_id: string | null
        }
        Insert: {
          created_at?: string | null
          generated_script?: string | null
          id?: string
          output_language?: string | null
          raw_prompt?: string | null
          review_notes?: string | null
          status?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Update: {
          created_at?: string | null
          generated_script?: string | null
          id?: string
          output_language?: string | null
          raw_prompt?: string | null
          review_notes?: string | null
          status?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          account_analysis_limit: number
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_unlimited: boolean
          name: string
          source_videos_limit: number
          videos_generated_limit: number
          voice_clones_limit: number
        }
        Insert: {
          account_analysis_limit: number
          created_at?: string | null
          description?: string | null
          id: string
          is_active?: boolean | null
          is_unlimited?: boolean
          name: string
          source_videos_limit: number
          videos_generated_limit: number
          voice_clones_limit: number
        }
        Update: {
          account_analysis_limit?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_unlimited?: boolean
          name?: string
          source_videos_limit?: number
          videos_generated_limit?: number
          voice_clones_limit?: number
        }
        Relationships: []
      }
      tiktok_conversation_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "tiktok_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_conversations: {
        Row: {
          analysis_id: string | null
          created_at: string | null
          id: string
          tiktok_handle: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string | null
          id?: string
          tiktok_handle?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string | null
          id?: string
          tiktok_handle?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tiktok_video_details: {
        Row: {
          id: string
          last_scraped_at: string
          raw_transcription: string | null
          transcription: Json | null
          video_id: string
        }
        Insert: {
          id?: string
          last_scraped_at: string
          raw_transcription?: string | null
          transcription?: Json | null
          video_id: string
        }
        Update: {
          id?: string
          last_scraped_at?: string
          raw_transcription?: string | null
          transcription?: Json | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_video_details_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "tiktok_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_videos: {
        Row: {
          account_id: string
          collect_count: number | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          features_json: Json | null
          id: string
          is_ad: boolean | null
          is_pinned: boolean | null
          is_slideshow: boolean | null
          is_sponsored: boolean | null
          last_scraped_at: string | null
          tiktok_handle: string | null
          tiktok_video_id: string
          title: string | null
          upload_date: string | null
          url: string
          video_height: number | null
          video_width: number | null
        }
        Insert: {
          account_id: string
          collect_count?: number | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          features_json?: Json | null
          id?: string
          is_ad?: boolean | null
          is_pinned?: boolean | null
          is_slideshow?: boolean | null
          is_sponsored?: boolean | null
          last_scraped_at?: string | null
          tiktok_handle?: string | null
          tiktok_video_id: string
          title?: string | null
          upload_date?: string | null
          url: string
          video_height?: number | null
          video_width?: number | null
        }
        Update: {
          account_id?: string
          collect_count?: number | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          features_json?: Json | null
          id?: string
          is_ad?: boolean | null
          is_pinned?: boolean | null
          is_slideshow?: boolean | null
          is_sponsored?: boolean | null
          last_scraped_at?: string | null
          tiktok_handle?: string | null
          tiktok_video_id?: string
          title?: string | null
          upload_date?: string | null
          url?: string
          video_height?: number | null
          video_width?: number | null
        }
        Relationships: []
      }
      tiktok_videos_stats: {
        Row: {
          comments: number | null
          days_since_last_post: number | null
          effect_stickers: Json | null
          engagement_rate: number | null
          id: string
          is_top_10: boolean | null
          is_viral: boolean | null
          likes: number | null
          shares: number | null
          snapshot_date: string | null
          subtitle_languages: string[] | null
          video_id: string
          views: number | null
        }
        Insert: {
          comments?: number | null
          days_since_last_post?: number | null
          effect_stickers?: Json | null
          engagement_rate?: number | null
          id?: string
          is_top_10?: boolean | null
          is_viral?: boolean | null
          likes?: number | null
          shares?: number | null
          snapshot_date?: string | null
          subtitle_languages?: string[] | null
          video_id: string
          views?: number | null
        }
        Update: {
          comments?: number | null
          days_since_last_post?: number | null
          effect_stickers?: Json | null
          engagement_rate?: number | null
          id?: string
          is_top_10?: boolean | null
          is_viral?: boolean | null
          likes?: number | null
          shares?: number | null
          snapshot_date?: string | null
          subtitle_languages?: string[] | null
          video_id?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_videos_stats_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "tiktok_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          account_analysis_limit: number
          account_analysis_used: number
          created_at: string
          current_plan_id: string
          id: string
          last_reset_date: string
          next_reset_date: string
          source_videos_limit: number
          source_videos_used: number
          subscription_status: string | null
          token_limit: number | null
          tokens_used: number | null
          updated_at: string
          user_id: string
          videos_generated: number
          videos_generated_limit: number
          voice_clones_limit: number
          voice_clones_used: number
        }
        Insert: {
          account_analysis_limit?: number
          account_analysis_used?: number
          created_at?: string
          current_plan_id?: string
          id?: string
          last_reset_date?: string
          next_reset_date?: string
          source_videos_limit?: number
          source_videos_used?: number
          subscription_status?: string | null
          token_limit?: number | null
          tokens_used?: number | null
          updated_at?: string
          user_id: string
          videos_generated?: number
          videos_generated_limit?: number
          voice_clones_limit?: number
          voice_clones_used?: number
        }
        Update: {
          account_analysis_limit?: number
          account_analysis_used?: number
          created_at?: string
          current_plan_id?: string
          id?: string
          last_reset_date?: string
          next_reset_date?: string
          source_videos_limit?: number
          source_videos_used?: number
          subscription_status?: string | null
          token_limit?: number | null
          tokens_used?: number | null
          updated_at?: string
          user_id?: string
          videos_generated?: number
          videos_generated_limit?: number
          voice_clones_limit?: number
          voice_clones_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_usage_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_voices: {
        Row: {
          created_at: string
          elevenlabs_voice_id: string
          id: string
          user_id: string
          voice_name: string
        }
        Insert: {
          created_at?: string
          elevenlabs_voice_id: string
          id?: string
          user_id: string
          voice_name: string
        }
        Update: {
          created_at?: string
          elevenlabs_voice_id?: string
          id?: string
          user_id?: string
          voice_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_voices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          clerk_user_id: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          clerk_user_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          clerk_user_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      video_requests: {
        Row: {
          caption_config: Json | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          output_language: string | null
          processing_started_at: string | null
          render_duration: number | null
          render_id: string | null
          render_status: string | null
          render_url: string | null
          script_id: string | null
          selected_videos: string[] | null
          size: number | null
          snapshot_url: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          caption_config?: Json | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          output_language?: string | null
          processing_started_at?: string | null
          render_duration?: number | null
          render_id?: string | null
          render_status?: string | null
          render_url?: string | null
          script_id?: string | null
          selected_videos?: string[] | null
          size?: number | null
          snapshot_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          caption_config?: Json | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          output_language?: string | null
          processing_started_at?: string | null
          render_duration?: number | null
          render_id?: string | null
          render_status?: string | null
          render_url?: string | null
          script_id?: string | null
          selected_videos?: string[] | null
          size?: number | null
          snapshot_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          analysis_completed_at: string | null
          analysis_data: Json | null
          analysis_error: string | null
          analysis_status: string | null
          clerk_user_id: string | null
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          storage_path: string | null
          tags: string[] | null
          title: string
          upload_url: string | null
          user_id: string | null
        }
        Insert: {
          analysis_completed_at?: string | null
          analysis_data?: Json | null
          analysis_error?: string | null
          analysis_status?: string | null
          clerk_user_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          storage_path?: string | null
          tags?: string[] | null
          title: string
          upload_url?: string | null
          user_id?: string | null
        }
        Update: {
          analysis_completed_at?: string | null
          analysis_data?: Json | null
          analysis_error?: string | null
          analysis_status?: string | null
          clerk_user_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          storage_path?: string | null
          tags?: string[] | null
          title?: string
          upload_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      videos_stats: {
        Row: {
          comments: number | null
          engagement_rate: number | null
          id: string
          likes: number | null
          shares: number | null
          snapshot_date: string | null
          video_id: string
          views: number | null
        }
        Insert: {
          comments?: number | null
          engagement_rate?: number | null
          id?: string
          likes?: number | null
          shares?: number | null
          snapshot_date?: string | null
          video_id: string
          views?: number | null
        }
        Update: {
          comments?: number | null
          engagement_rate?: number | null
          id?: string
          likes?: number | null
          shares?: number | null
          snapshot_date?: string | null
          video_id?: string
          views?: number | null
        }
        Relationships: []
      }
      voice_clones: {
        Row: {
          created_at: string | null
          elevenlabs_voice_id: string | null
          id: string
          is_public: boolean
          name: string | null
          sample_files: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          is_public?: boolean
          name?: string | null
          sample_files?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          is_public?: boolean
          name?: string | null
          sample_files?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_clones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          platform: Database["public"]["Enums"]["platform_preference"]
          tiktok_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          platform: Database["public"]["Enums"]["platform_preference"]
          tiktok_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          platform?: Database["public"]["Enums"]["platform_preference"]
          tiktok_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      script_drafts_list: {
        Row: {
          current_script: string | null
          estimated_duration: number | null
          id: string | null
          message_count: number | null
          output_language: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          word_count: number | null
        }
        Insert: {
          current_script?: never
          estimated_duration?: number | null
          id?: string | null
          message_count?: number | null
          output_language?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          word_count?: number | null
        }
        Update: {
          current_script?: never
          estimated_duration?: number | null
          id?: string | null
          message_count?: number | null
          output_language?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "script_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_storage_bucket: {
        Args: {
          bucket_name: string
          public_access?: boolean
          file_size_limit?: number
          allowed_mime_types?: string[]
        }
        Returns: undefined
      }
      create_storage_policy: {
        Args: {
          bucket_name: string
          policy_name: string
          operation: string
          policy_using?: string
          policy_check?: string
          policy_role?: unknown
        }
        Returns: undefined
      }
      increment_user_usage: {
        Args: { p_user_id: string; p_field_to_increment: string }
        Returns: undefined
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      make_admin_by_email: {
        Args: { admin_email: string }
        Returns: string
      }
      sync_clerk_user: {
        Args: { clerk_user_id: string; email: string }
        Returns: undefined
      }
      validate_tiktok_url: {
        Args: { url: string }
        Returns: boolean
      }
    }
    Enums: {
      platform_preference: "ios" | "android"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      platform_preference: ["ios", "android"],
    },
  },
} as const
