-- CreateTable
CREATE TABLE "subcontrols" (
    "id" TEXT NOT NULL,
    "control_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ControlStatus" NOT NULL DEFAULT 'Not_Started',
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcontrols_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "subcontrols" ADD CONSTRAINT "subcontrols_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
