using System.Linq.Expressions;

namespace MedTriage.Server.Repositories;

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

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
