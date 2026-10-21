using System.Linq.Expressions;

namespace MedTriage.Server.Repositories;

/// <summary>
/// The only layer that talks to the database. One generic repository serves every table
/// (inject <c>IDocumentRepository&lt;Patient&gt;</c>, <c>IDocumentRepository&lt;Symptom&gt;</c>, …).
///
/// Reads are no-tracking by default. Use <c>tracking: true</c> (or <see cref="GetByIdAsync"/>) when you
/// intend to change the entity and then call <see cref="SaveChangesAsync"/>.
/// </summary>
public interface IDocumentRepository<T> where T : class
{
    /// <summary>Start a custom query (filters, includes, ordering, grouping) for anything the helpers below don't cover.</summary>
    IQueryable<T> Query(bool tracking = false);

    /// <summary>Find by primary key. The result is tracked, so changes are saved by <see cref="SaveChangesAsync"/>.</summary>
    Task<T?> GetByIdAsync(int id, CancellationToken ct = default);

    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, bool tracking = false, CancellationToken ct = default);

    /// <summary>All rows matching <paramref name="predicate"/> (or every row when it is null).</summary>
    Task<List<T>> ListAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default);

    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);

    Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default);

    Task AddAsync(T entity, CancellationToken ct = default);

    Task AddRangeAsync(IEnumerable<T> entities, CancellationToken ct = default);

    void Update(T entity);

    void Remove(T entity);

    void RemoveRange(IEnumerable<T> entities);

    /// <summary>
    /// Writes all pending changes in one transaction. Repositories share the request's DbContext,
    /// so this also saves changes made through other repositories in the same request.
    /// </summary>
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
