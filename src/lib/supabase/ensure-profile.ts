import { createClient } from './client'

export async function ensureUserProfile() {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (profile) return profile

    const { data: newProfile, error } = await supabase
        .from('user_profiles')
        .insert({
            user_id: user.id,
            full_name: user.email?.split('@')[0] || 'Usuário',
            display_name: user.email?.split('@')[0] || 'Usuário',
            role: 'editor',
        } as never)
        .select()
        .single()

    if (error) console.error('Error creating profile:', error)
    return newProfile
}
