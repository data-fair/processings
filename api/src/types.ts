/* eslint-disable */

export type PrivateAccess {
  type: 'user' | 'organization'
  id: string
  name: string
}

export type Access {
  public: boolean;
  privateAccess: PrivateAccess[]
}