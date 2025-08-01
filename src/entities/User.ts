// src/entities/User.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity("users")
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    address!: string;

    @Column({ nullable: true })
    publicKey?: string;

    @Column({ type: 'int', default: 0 })
    xp!: number;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date;
}