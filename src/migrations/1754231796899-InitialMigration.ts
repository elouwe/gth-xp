import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1754231796899 implements MigrationInterface {
    name = 'InitialMigration1754231796899'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Instead of dropping the column, modify it
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "txHash" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "txHash" TYPE text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert the changes
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "txHash" TYPE varchar`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "txHash" SET NOT NULL`);
    }
}