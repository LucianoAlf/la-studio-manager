-- Fix: Permitir leitura pública do mike_config (é config global do sistema)
-- A RLS atual só permite SELECT para admins autenticados via auth.uid(),
-- mas no iframe (Simple Browser) o auth não funciona.

-- Remover policy restritiva de SELECT
DROP POLICY IF EXISTS "Admins can view mike_config" ON mike_config;

-- Criar policy que permite leitura para qualquer usuário autenticado ou anônimo
-- (mike_config é singleton com dados públicos de configuração)
CREATE POLICY "Anyone can view mike_config"
  ON mike_config
  FOR SELECT
  USING (true);

-- Manter policy de UPDATE apenas para admins (via service_role ou auth.uid)
-- A policy "Admins can update mike_config" já existe e está correta
