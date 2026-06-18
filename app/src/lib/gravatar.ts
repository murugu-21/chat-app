export async function gravatarUrl(email: string): Promise<string> {
    const normalized = email.trim().toLowerCase();
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    const hash = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `https://www.gravatar.com/avatar/${hash}?d=404`;
}
