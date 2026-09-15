import type { Member as MemberDto, MemberListResponse } from '@wumboo/shared';
import type { MemberDetail } from '../../domain/entities/Membership.js';

export function presentMember(member: MemberDetail): MemberDto {
  return {
    userId: member.userId,
    email: member.email,
    displayName: member.displayName,
    role: member.role,
    joinedAt: member.createdAt.toISOString(),
  };
}

export function presentMemberList(members: MemberDetail[]): MemberListResponse {
  return { members: members.map(presentMember) };
}
