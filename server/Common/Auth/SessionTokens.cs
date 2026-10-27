using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace MedTriage.Server.Common.Auth;

/// <summary>Cookie tokens for staff and admin sessions. Only the hash is stored, so a leaked database can't be replayed.</summary>
public static class SessionTokens
{
    public static string New() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
