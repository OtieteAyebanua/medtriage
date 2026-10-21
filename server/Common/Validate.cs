using System.Text.RegularExpressions;

namespace MedTriage.Server.Common;

/// <summary>Input checks used by the services. Each one throws a 400 <see cref="ApiException"/> naming the field.</summary>
public static partial class Validate
{
    public static string RequiredString(string? value, string field, int max = 2000)
    {
        var s = value?.Trim();
        if (string.IsNullOrEmpty(s)) throw ApiException.BadRequest($"{field} is required", field);
        if (s.Length > max) throw ApiException.BadRequest($"{field} is too long (max {max} characters)", field);
        return s;
    }

    /// <summary>Trimmed value, or null when missing or blank.</summary>
    public static string? OptionalString(string? value, string field, int max = 2000)
    {
        var s = value?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        if (s.Length > max) throw ApiException.BadRequest($"{field} is too long (max {max} characters)", field);
        return s;
    }

    /// <summary>Case-insensitive match against <paramref name="allowed"/>; returns the canonical spelling.</summary>
    public static string OneOf(string? value, IReadOnlyCollection<string> allowed, string field, string? fallback = null)
    {
        if (string.IsNullOrWhiteSpace(value) && fallback is not null) return fallback;
        var match = allowed.FirstOrDefault(a => string.Equals(a, value?.Trim(), StringComparison.OrdinalIgnoreCase));
        return match ?? throw ApiException.BadRequest($"{field} must be one of: {string.Join(", ", allowed)}", field);
    }

    public static int PositiveId(int? value, string field)
    {
        if (value is not > 0) throw ApiException.BadRequest($"{field} must be a positive integer", field);
        return value.Value;
    }

    public static double? OptionalNumber(double? value, string field, double min, double max)
    {
        if (value is null) return null;
        if (double.IsNaN(value.Value) || value < min || value > max)
        {
            throw ApiException.BadRequest($"{field} must be between {min} and {max}", field);
        }
        return value;
    }

    /// <summary>"120/80" style reading, normalised to "sys/dia"; null when blank.</summary>
    public static string? OptionalBloodPressure(string? value, string field = "bloodPressure")
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var m = BloodPressurePattern().Match(value.Trim());
        if (!m.Success) throw ApiException.BadRequest("Blood pressure must look like 120/80", field);

        var sys = int.Parse(m.Groups[1].Value);
        var dia = int.Parse(m.Groups[2].Value);
        if (sys is < 40 or > 300 || dia is < 20 or > 200 || dia >= sys)
        {
            throw ApiException.BadRequest("Blood pressure values are out of range", field);
        }
        return $"{sys}/{dia}";
    }

    /// <summary>Lowercased address, or null when blank.</summary>
    public static string? OptionalEmail(string? value, string field = "email")
    {
        var email = OptionalString(value, field, 100)?.ToLowerInvariant();
        if (email is not null && !EmailPattern().IsMatch(email))
        {
            throw ApiException.BadRequest("Email address is not valid", field);
        }
        return email;
    }

    [GeneratedRegex(@"^(\d{2,3})\s*/\s*(\d{2,3})$")]
    private static partial Regex BloodPressurePattern();

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailPattern();
}
