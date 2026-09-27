SET session_replication_role = replica;
DELETE FROM class_b_exam_scores WHERE enrollment_id BETWEEN 5001 AND 5006; DELETE FROM class_b_practice_attendance WHERE class_b_session_id BETWEEN 4001 AND 4009; DELETE FROM class_b_sessions WHERE id BETWEEN 4001 AND 4009; DELETE FROM instructor_monthly_payments WHERE instructor_id IN (801,802); DELETE FROM instructor_monthly_hours WHERE instructor_id IN (801,802); DELETE FROM fixed_expenses; DELETE FROM expenses; DELETE FROM payments WHERE enrollment_id BETWEEN 5001 AND 5006; DELETE FROM enrollments WHERE id BETWEEN 5001 AND 5006; DELETE FROM vehicles WHERE id IN (601,602); DELETE FROM students WHERE id IN (701,702,703); DELETE FROM instructors WHERE id IN (801,802); DELETE FROM users WHERE id BETWEEN 9001 AND 9013;
INSERT INTO users (id, rut, first_names, paternal_last_name, maternal_last_name, email, role_id, branch_id, supabase_uid) VALUES
 (9001,'1-9','Ana','Admin','X','a@x.cl',1,1,'00000000-0000-0000-0000-000000000001'),
 (9002,'2-7','Sara','Secre','X','s@x.cl',2,1,'00000000-0000-0000-0000-000000000002'),
 (9003,'3-5','Ivan','Uno','X','i1@x.cl',3,1,NULL),
 (9004,'4-3','Beto','Dos','X','i2@x.cl',3,2,NULL),
 (9011,'11-1','Alu','Uno','X','s1@x.cl',4,1,NULL),
 (9012,'12-1','Alu','Dos','X','s2@x.cl',4,1,NULL),
 (9013,'13-1','Alu','Tres','X','s3@x.cl',4,1,NULL);
INSERT INTO instructors (id, user_id, active) VALUES (801, 9003, true), (802, 9004, true);
INSERT INTO students (id, user_id, birth_date) VALUES (701,9011,'2000-01-01'),(702,9012,'2000-01-01'),(703,9013,'2000-01-01');
INSERT INTO vehicles (id, license_plate, brand, model, year, branch_id, status) VALUES (601,'AA-11','X','Y',2020,1,'operational'),(602,'BB-22','X','Y',2020,1,'maintenance');
INSERT INTO enrollments (id, number, student_id, course_id, branch_id, status, license_group, pending_balance, certificate_enabled, created_at) VALUES
 (5001,'E1',701,1,1,'active','class_b',100000,false,'2026-09-05 12:00-03'),
 (5002,'E2',702,1,1,'active','class_b',50000,true,'2026-06-01 12:00-04'),
 (5003,'E3',703,1,1,'completed','class_b',0,true,'2025-09-10 12:00-03'),
 (5004,'E4',701,3,1,'active','professional',0,false,'2026-09-06 12:00-03'),
 (5005,'E5',702,7,2,'active','class_b',0,false,'2026-09-10 12:00-03'),
 (5006,NULL,703,1,1,'draft','class_b',0,false,'2026-09-12 12:00-03');
INSERT INTO payments (enrollment_id, total_amount, status, payment_date) VALUES
 (5001,200000,'paid','2026-09-06'),
 (5001,300000,'pending',NULL),
 (5004,500000,'paid','2026-09-07'),
 (5005,150000,'paid','2026-09-08'),
 (5003,100000,'paid','2025-09-15'),
 (5002,50000,'completado','2026-09-20');
INSERT INTO expenses (branch_id, description, amount, date) VALUES (1,'bencina',30000,'2026-09-10'),(2,'bencina',20000,'2026-09-11');
INSERT INTO fixed_expenses (branch_id, category, description, amount, date) VALUES (1,'rent','local',100000,'2026-09-01');
INSERT INTO branch_payroll_config (branch_id, amount_per_hour) VALUES (1,6000) ON CONFLICT (branch_id) DO UPDATE SET amount_per_hour=6000;
DELETE FROM branch_payroll_config WHERE branch_id=2;
INSERT INTO instructor_monthly_hours (instructor_id, period, practical_sessions, total_equivalent) VALUES (801,'2026-09',10,7.5),(801,'2026-08',8,6.0),(802,'2026-09',4,3.0);
INSERT INTO instructor_monthly_payments (instructor_id, period, base_salary, advances_deducted, net_payment, payment_status) VALUES (801,'2026-08',300000,0,300000,'paid');
INSERT INTO class_b_sessions (id, enrollment_id, instructor_id, vehicle_id, class_number, scheduled_at, duration_min, status, completed_at, cancelled_at) VALUES
 (4001,5001,801,601,1,'2026-09-10 10:00-03',45,'completed','2026-09-10 10:45-03',NULL),
 (4002,5001,801,601,2,'2026-09-11 10:00-03',45,'completed','2026-09-11 10:45-03',NULL),
 (4003,5001,801,601,3,'2026-09-12 10:00-03',45,'completed','2026-09-12 10:45-03',NULL),
 (4004,5001,801,601,4,'2026-09-13 10:00-03',45,'cancelled',NULL,'2026-09-13 08:00-03'),
 (4005,5001,801,601,5,'2026-09-14 10:00-03',45,'no_show',NULL,NULL),
 (4006,5001,801,601,6,'2026-09-29 10:00-03',45,'scheduled',NULL,NULL),
 (4007,5006,801,601,1,'2026-09-29 12:00-03',45,'reserved',NULL,NULL),
 (4008,5005,802,601,1,'2026-09-15 10:00-03',45,'completed','2026-09-15 10:45-03',NULL),
 (4009,5004,801,601,1,'2026-09-16 10:00-03',45,'completed','2026-09-16 10:45-03',NULL);
INSERT INTO class_b_practice_attendance (class_b_session_id, student_id, status, recorded_at) VALUES (4005,701,'absent','2026-09-14 21:00-03');
INSERT INTO class_b_exam_scores (enrollment_id, date, score, passed) VALUES (5001,'2026-09-15',30,true),(5001,'2026-09-20',20,false);
SET session_replication_role = origin;
