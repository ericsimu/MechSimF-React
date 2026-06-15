export function getCurrentUser(): string {
  return localStorage.getItem("current_user") || "user1";
}

export function setCurrentUser(name: string): void {
  localStorage.setItem("current_user", name);
}
