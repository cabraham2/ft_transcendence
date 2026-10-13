import { BadRequestException } from '@nestjs/common';

export function assertStrongPassword(password: string): void {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (
    password.length < 8 ||
    password.length > 72 ||
    !hasUpper ||
    !hasLower ||
    !hasNumber ||
    !hasSymbol
  ) {
    throw new BadRequestException(
      'Password must be 8-72 characters and include uppercase, lowercase, number, and symbol.',
    );
  }
}
