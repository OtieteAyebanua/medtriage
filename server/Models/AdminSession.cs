namespace MedTriage.Server.Models;

/// <summary>A signed-in admin console session, referenced by the medtriage_admin cookie. Table: admin_sessions.</summary>
public class AdminSession
{
    public int Id { get; set; }

    /// <summary>SHA-256 hash of the cookie token.</summary>
    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
