using MedTriage.Server.Common;
using Microsoft.Extensions.Options;

namespace MedTriage.Server.Services.Patients;

public class PhotoStorage(IOptions<PhotoStorageOptions> options, AppPaths paths) : IPhotoStorage
{
    public const long MaxBytes = 5 * 1024 * 1024;

    private readonly string _root = paths.Resolve(options.Value.Directory);

    /// <summary>
    /// Detects JPEG, PNG or WebP from the file's first bytes (never trust the client's MIME type).
    /// Returns the file extension, or null for anything else.
    /// </summary>
    public static string? DetectExtension(ReadOnlySpan<byte> data) => DetectContentType(data) switch
    {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        _ => null,
    };

    public async Task<string> SaveAsync(int patientId, byte[] data, string extension, CancellationToken ct = default)
    {
        var relative = $"patients/{patientId}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.{extension}";
        var fullPath = ResolveSafe(relative);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await File.WriteAllBytesAsync(fullPath, data, ct);
        return relative;
    }

    public StoredPhoto? Find(string relativePath)
    {
        var fullPath = ResolveSafe(relativePath);
        if (!File.Exists(fullPath)) return null;

        Span<byte> header = stackalloc byte[12];
        using (var stream = File.OpenRead(fullPath))
        {
            header = header[..stream.Read(header)];
        }
        return new StoredPhoto(fullPath, DetectContentType(header) ?? "application/octet-stream");
    }

    public void Delete(string? relativePath)
    {
        if (string.IsNullOrEmpty(relativePath)) return;
        var fullPath = ResolveSafe(relativePath);
        if (File.Exists(fullPath)) File.Delete(fullPath);
    }

    private static string? DetectContentType(ReadOnlySpan<byte> b)
    {
        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return "image/jpeg";
        if (b.Length >= 4 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return "image/png";
        if (b.Length >= 12 && b[..4].SequenceEqual("RIFF"u8) && b[8..12].SequenceEqual("WEBP"u8)) return "image/webp";
        return null;
    }

    /// <summary>Full path inside the upload folder; rejects paths that would escape it.</summary>
    private string ResolveSafe(string relativePath)
    {
        var fullPath = Path.GetFullPath(Path.Combine(_root, relativePath));
        if (!fullPath.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Invalid upload path");
        }
        return fullPath;
    }
}
