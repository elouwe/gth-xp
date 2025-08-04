import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1754245723606 implements MigrationInterface {
    name = 'InitialMigration1754245723606'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ADD "contract_address" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "contract_owner" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "contract_version" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "last_op_time" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "status" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "last_op_time"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "contract_version"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "contract_owner"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "contract_address"`);
    }
}