const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rhxqwraqpabgecgojytj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoeHF3cmFxcGFiZ2VjZ29qeXRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMzNDM1MCwiZXhwIjoyMDg1OTEwMzUwfQ.w_z7jXRN6GX9BUuvgMvuJVSy-ack8fG1AQsYdac6dJs';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createAdminUser() {
  try {
    // Deletar usuário existente
    const { data: existingUser, error: findError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', '2671e819-7062-48f3-9692-1892d825dc3e')
      .single();
    
    if (existingUser) {
      await supabase.auth.admin.deleteUser('2671e819-7062-48f3-9692-1892d825dc3e');
    }

    // Criar usuário admin
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@gmail.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: { name: 'Administrador', role: 'admin' }
    });

    if (error) {
      console.error('Erro ao criar usuário:', error);
      process.exit(1);
    }

    console.log('Usuário criado com sucesso:', data.user.id);

    // Criar perfil
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: data.user.id,
        full_name: 'Administrador do Sistema',
        display_name: 'Admin',
        role: 'admin',
        is_admin: true,
        is_active: true,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        notification_preferences: { push: true, email: true, whatsapp: true }
      });

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError);
      process.exit(1);
    }

    // Criar configurações de notificação
    const { error: notifError } = await supabase
      .from('user_notification_settings')
      .insert({
        user_id: data.user.id,
        calendar_reminders_enabled: true,
        calendar_reminder_days: [3, 1],
        calendar_reminder_time: '09:00:00',
        weekly_summary_enabled: true,
        urgent_alerts_enabled: true,
        timezone: 'America/Sao_Paulo'
      });

    if (notifError) {
      console.error('Erro ao criar configurações:', notifError);
      process.exit(1);
    }

    console.log('✅ Usuário admin criado com sucesso!');
    console.log('Email: admin@gmail.com');
    console.log('Senha: admin123');
    
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
}

createAdminUser();
