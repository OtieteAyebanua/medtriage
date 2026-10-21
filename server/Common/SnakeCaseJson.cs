using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;

namespace MedTriage.Server.Common;

/// <summary>
/// Marks a DTO whose JSON property names are snake_case (PatientId -> "patient_id").
/// Everything else uses the default camelCase. The frontend expects both, see "Field casing" in API_README.md.
/// </summary>
[AttributeUsage(AttributeTargets.Class, Inherited = true)]
public sealed class SnakeCaseJsonAttribute : Attribute;

public static class SnakeCaseJson
{
    /// <summary>System.Text.Json type-info modifier that applies <see cref="SnakeCaseJsonAttribute"/>.</summary>
    public static void Apply(JsonTypeInfo typeInfo)
    {
        if (typeInfo.Kind != JsonTypeInfoKind.Object) return;
        if (typeInfo.Type.GetCustomAttribute<SnakeCaseJsonAttribute>(inherit: true) is null) return;

        foreach (var property in typeInfo.Properties)
        {
            if (property.AttributeProvider is MemberInfo member)
            {
                property.Name = JsonNamingPolicy.SnakeCaseLower.ConvertName(member.Name);
            }
        }
    }
}
