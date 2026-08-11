/** Loads a user from the application API. */
export async function loadUser(id: string): Promise<Response> {
  return fetch(`/api/users/${id}`);
}
