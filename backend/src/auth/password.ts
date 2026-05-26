import bcrypt from "bcrypt";

const COST = 12;

export const password = {
  hash: (plain: string): Promise<string> => bcrypt.hash(plain, COST),
  verify: (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash),
};
