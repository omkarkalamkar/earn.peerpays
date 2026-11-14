#!/bin/bash
# MongoDB Access Helper Script for earn.peerpays.in

SERVER="130.210.25.204"
SSH_KEY="/Users/omkar/Documents/Aniket_Booking/ssh-key-2026-11-12.key"
DB_NAME="earn_peerpays"

echo "======================================"
echo "  PeerPays MongoDB Access Helper"
echo "======================================"
echo ""
echo "Choose an option:"
echo "1) Open MongoDB Shell (mongosh)"
echo "2) Create SSH Tunnel for MongoDB Compass (port 27017)"
echo "3) Export entire database to local file"
echo "4) Show all collections"
echo "5) Count documents in all collections"
echo "6) Backup database"
echo ""
read -p "Enter option (1-6): " option

case $option in
  1)
    echo "Opening MongoDB Shell..."
    ssh -i "$SSH_KEY" ubuntu@$SERVER "mongosh $DB_NAME"
    ;;
  
  2)
    echo "Creating SSH tunnel on localhost:27017..."
    echo "MongoDB Compass connection string: mongodb://localhost:27017/$DB_NAME"
    echo ""
    echo "Press Ctrl+C to stop tunnel"
    ssh -i "$SSH_KEY" -L 27017:localhost:27017 ubuntu@$SERVER -N
    ;;
  
  3)
    echo "Exporting database..."
    BACKUP_FILE="peerpays_backup_$(date +%Y%m%d_%H%M%S).gz"
    ssh -i "$SSH_KEY" ubuntu@$SERVER "mongodump --db=$DB_NAME --archive --gzip" > "$BACKUP_FILE"
    echo "✅ Database exported to: $BACKUP_FILE"
    echo "To restore: mongorestore --archive=$BACKUP_FILE --gzip"
    ;;
  
  4)
    echo "Collections in $DB_NAME:"
    ssh -i "$SSH_KEY" ubuntu@$SERVER "mongosh $DB_NAME --quiet --eval 'db.getCollectionNames()'"
    ;;
  
  5)
    echo "Document counts:"
    ssh -i "$SSH_KEY" ubuntu@$SERVER "mongosh $DB_NAME --quiet --eval '
      db.getCollectionNames().forEach(function(col) {
        print(col + \": \" + db[col].countDocuments());
      });
    '"
    ;;
  
  6)
    echo "Creating backup..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="mongodb_backups"
    mkdir -p "$BACKUP_DIR"
    
    ssh -i "$SSH_KEY" ubuntu@$SERVER "mongodump --db=$DB_NAME --archive --gzip" > "$BACKUP_DIR/peerpays_$TIMESTAMP.gz"
    
    echo "✅ Backup created: $BACKUP_DIR/peerpays_$TIMESTAMP.gz"
    echo "Size: $(du -h "$BACKUP_DIR/peerpays_$TIMESTAMP.gz" | cut -f1)"
    ;;
  
  *)
    echo "Invalid option"
    exit 1
    ;;
esac
