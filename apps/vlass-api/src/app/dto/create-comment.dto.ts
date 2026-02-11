export class CreateCommentDto {
  post_id!: string;
  parent_id?: string;
  content!: string;
}
