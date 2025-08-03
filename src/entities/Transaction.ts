import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './User';

@Entity("transactions")
export class Transaction {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'op_id', nullable: false })
    opId!: string;

    @Column({ name: 'tx_hash', type: 'text', nullable: true })
    txHash!: string | null;

    @Column({ name: 'amount' })
    amount!: number;

    @Column({ name: 'timestamp', type: 'timestamp' })
    timestamp!: Date;

    @Column({ name: 'sender_address' })
    senderAddress!: string;

    @Column({ name: 'receiver_address' })
    receiverAddress!: string;

    @Column({ name: 'status' })
    status!: string;

    @Column({ name: 'description', type: 'text', nullable: true })
    description!: string;

    @ManyToOne(() => User, user => user.transactions)
    user!: User;
}