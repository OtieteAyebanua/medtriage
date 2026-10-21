namespace MedTriage.Server.Models;

/// <summary>A signed-in session, referenced by the medtriage_session cookie. Table: sessions.</summary>
public class Session
{
    public int Id { get; set; }
    public string Token { get; set; } = null!;
    public int UserId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public HealthcareWorker Worker { get; set; } = null!;
}
