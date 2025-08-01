// src/data-source.ts
import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "ton_user",
  password: "SEGMYH8yOd1n",
  database: "ton_xp_db",
  entities: [User],
  synchronize: false, 
  logging: true,
  migrations: [__dirname + "/migrations/*.ts"],
});