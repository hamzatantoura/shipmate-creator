UPDATE auth.users
SET encrypted_password = crypt('m@sarat', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'msarat1@courier.sila.local';