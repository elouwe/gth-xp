import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Transaction } from './Transaction';

@Entity("users")
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'address', unique: true })
    address!: string;

    @Column({ name: 'public_key', nullable: true })
    publicKey?: string;

    @Column({ name: 'xp', type: 'int', default: 0 })
    xp!: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt!: Date;

    @OneToMany(() => Transaction, transaction => transaction.user, {
        cascade: true 
    })
    transactions!: Transaction[];
}