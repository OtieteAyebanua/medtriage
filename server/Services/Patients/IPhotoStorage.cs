namespace MedTriage.Server.Services.Patients;

/// <summary>Patient photos on the server's disk. The database stores only the relative path.</summary>
public interface IPhotoStorage
{
    /// <summary>Saves the image and returns its new relative path (unique per upload, e.g. patients/12-1760000000000.jpg).</summary>
    Task<string> SaveAsync(int patientId, byte[] data, string extension, CancellationToken ct = default);

    /// <summary>The stored file, or null if it doesn't exist.</summary>
    StoredPhoto? Find(string relativePath);

    /// <summary>Deletes the file if it exists.</summary>
    void Delete(string? relativePath);
}

public record StoredPhoto(string FullPath, string ContentType);

public class PhotoStorageOptions
{
    /// <summary>Folder for uploads, relative to the data folder (see <see cref="Common.AppPaths"/>) unless absolute.</summary>
    public string Directory { get; set; } = "uploads";
}
