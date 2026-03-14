/**
 * Helpers para resultados de operações do banco de dados (Drizzle + MySQL2).
 *
 * O Drizzle com mysql2 retorna resultados de UPDATE/DELETE como um array onde o
 * primeiro elemento é um ResultSetHeader contendo `affectedRows`. O tipo retornado
 * é `QueryResult`, mas o valor real em runtime pode variar conforme a versão do driver.
 *
 * Este helper encapsula a extração de affectedRows de forma segura e consistente.
 */

/**
 * Extrai o número de linhas afetadas de um resultado de UPDATE/DELETE/INSERT do Drizzle.
 * Suporta tanto o formato `[{ affectedRows }]` (mysql2 padrão) quanto `{ rowsAffected }` (outros drivers).
 *
 * @param result - Resultado retornado por db.update(), db.delete() ou db.insert()
 * @returns Número de linhas afetadas, ou 0 se não for possível determinar
 */
export function getAffectedRows(result: unknown): number {
  return (result as any)?.[0]?.affectedRows ?? (result as any)?.rowsAffected ?? 0;
}
