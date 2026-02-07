export class CreateUserDto {
  username!: string;
  email!: string;
  github_id?: number;
  full_name?: string;
}
