import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import NfcManager, { NfcTech } from "react-native-nfc-manager";

NfcManager.start();

export default function App() {
  const apiBase = "http://raspberrypi.local:8000";
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  useEffect(() => {
    fetchAccounts();
    fetchProducts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch(`${apiBase}/accounts`);
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("Erreur", "Chargement comptes : " + e.message);
    }
  }

  async function fetchProducts() {
    try {
      const res = await fetch(`${apiBase}/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("Erreur", "Chargement produits : " + e.message);
    }
  }

  async function readUidFromCard() {
    try {
      await NfcManager.cancelTechnologyRequest();
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      return tag?.id || null;
    } catch (err) {
      Alert.alert("Erreur NFC", "Lecture UID échouée: " + err.message);
      return null;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  // --- Modal Create Account ---
  function ModalCreateAccount({ onClose }) {
    const [nom, setNom] = useState("");
    const [prenom, setPrenom] = useState("");
    const [adresse, setAdresse] = useState("");
    const [loading, setLoading] = useState(false);
    const [messageLocal, setMessageLocal] = useState("");

    async function onReadAndCreate() {
      if (loading) return;
      if (!nom || !prenom || !adresse) {
        return Alert.alert("Erreur", "Veuillez remplir tous les champs");
      }

      setLoading(true);
      setMessageLocal("Approchez la carte NFC...");

      const uid = await readUidFromCard();
      if (!uid) {
        setLoading(false);
        setMessageLocal("");
        return;
      }

      try {
        const res = await fetch(`${apiBase}/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rfid_uid: uid,
            nom,
            prenom,
            adresse,
          }),
        });

        const json = await res.json();
        Alert.alert("Compte créé", `UID : ${uid}\n${json.message || ""}`);
        fetchAccounts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setLoading(false);
        setMessageLocal("");
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Créer un compte</Text>
        <TextInput placeholder="Nom" style={styles.input} value={nom} onChangeText={setNom} editable={!loading} />
        <TextInput placeholder="Prénom" style={styles.input} value={prenom} onChangeText={setPrenom} editable={!loading} />
        <TextInput placeholder="Adresse" style={styles.input} value={adresse} onChangeText={setAdresse} editable={!loading} />
        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={onReadAndCreate} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Lecture..." : "Lire la carte NFC"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.message}>{messageLocal}</Text>
      </View>
    );
  }

  // --- Modal Add Product ---
  function ModalAddProduct({ onClose }) {
    const [nom, setNom] = useState("");
    const [prix, setPrix] = useState("");

    async function onAddProduct() {
      if (!nom || !prix) {
        return Alert.alert("Erreur", "Nom et prix requis");
      }
      try {
        await fetch(`${apiBase}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nom, price: parseFloat(prix) }),
        });
        fetchProducts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Ajouter un produit</Text>
        <TextInput placeholder="Nom" style={styles.input} value={nom} onChangeText={setNom} />
        <TextInput placeholder="Prix" style={styles.input} value={prix} onChangeText={setPrix} keyboardType="numeric" />
        <TouchableOpacity style={styles.button} onPress={onAddProduct}>
          <Text style={styles.buttonText}>Ajouter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Modal Make Purchase ---
  function ModalMakePurchase({ onClose }) {
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [loading, setLoading] = useState(false);

    function toggleProductSelection(id) {
      setSelectedProductIds((prev) =>
        prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
      );
    }

    async function onPurchase() {
      if (selectedProductIds.length === 0) {
        return Alert.alert("Erreur", "Sélectionnez au moins un produit");
      }
      setLoading(true);
      const uid = await readUidFromCard();
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${apiBase}/purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rfid_uid: uid, product_ids: selectedProductIds }),
        });
        const json = await res.json();
        Alert.alert("Achat", json.message || "Achat effectué");
        fetchAccounts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setLoading(false);
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Faire un achat</Text>
        <ScrollView style={{ maxHeight: 200, marginBottom: 10 }}>
          {products.map(prod => (
            <TouchableOpacity
              key={prod.id}
              style={styles.checkboxContainer}
              onPress={() => toggleProductSelection(prod.id)}
              disabled={loading}
            >
              <View style={[
                styles.checkbox,
                selectedProductIds.includes(prod.id) && styles.checkboxChecked
              ]} />
              <Text style={styles.productLabel}>{prod.name} - €{prod.price.toFixed(2)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onPurchase}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Lecture..." : "Lire carte NFC et Payer"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onClose}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }


  // --- Modal Recharge Account ---
  function ModalRechargeAccount({ onClose }) {
    const [montant, setMontant] = useState("");
    const [loading, setLoading] = useState(false);

    async function onRecharge() {
      if (!montant) return Alert.alert("Erreur", "Montant requis");
      setLoading(true);
      const uid = await readUidFromCard();
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${apiBase}/accounts/${uid}/recharge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ montant: parseFloat(montant) }),
        });
        const json = await res.json();
        Alert.alert("Rechargement", json.message || "Solde rechargé");
        fetchAccounts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setLoading(false);
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Recharger un compte</Text>
        <TextInput placeholder="Montant" style={styles.input} value={montant} onChangeText={setMontant} keyboardType="numeric" />
        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={onRecharge} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Lecture..." : "Lire carte NFC"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Modal Delete Account ---
  function ModalDeleteAccount({ onClose }) {
    const [uid, setUid] = useState("");
    const [loading, setLoading] = useState(false);

    async function onDelete() {
      if (!uid) return Alert.alert("Erreur", "UID requis");
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/accounts/${uid}`, {
          method: "DELETE",
        });
        if (res.status === 200) {
          Alert.alert("Succès", "Compte supprimé");
          fetchAccounts();
          onClose();
        } else {
          const json = await res.json();
          Alert.alert("Erreur", json.detail || "Erreur suppression");
        }
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setLoading(false);
      }
    }

    async function onReadCard() {
      setLoading(true);
      const scannedUid = await readUidFromCard();
      if (scannedUid) setUid(scannedUid);
      setLoading(false);
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Supprimer un compte</Text>
        <TextInput placeholder="UID" style={styles.input} value={uid} onChangeText={setUid} editable={!loading} />
        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={onReadCard} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Lecture..." : "Lire carte NFC"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.deleteButton, loading && styles.buttonDisabled]} onPress={onDelete} disabled={loading}>
          <Text style={styles.buttonText}>Supprimer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Modal Delete Product ---
  function ModalDeleteProduct({ onClose }) {
    const [productId, setProductId] = useState("");
    const [loading, setLoading] = useState(false);

    async function onDelete() {
      if (!productId) return Alert.alert("Erreur", "ID produit requis");
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/products/${productId}`, {
          method: "DELETE",
        });
        if (res.status === 200) {
          Alert.alert("Succès", "Produit supprimé");
          fetchProducts();
          onClose();
        } else {
          const json = await res.json();
          Alert.alert("Erreur", json.detail || "Erreur suppression");
        }
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setLoading(false);
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Supprimer un produit</Text>
        <TextInput placeholder="ID produit" style={styles.input} value={productId} onChangeText={setProductId} keyboardType="numeric" editable={!loading} />
        <TouchableOpacity style={[styles.button, styles.deleteButton, loading && styles.buttonDisabled]} onPress={onDelete} disabled={loading}>
          <Text style={styles.buttonText}>Supprimer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Render Modal ---
  function renderModal() {
    if (!modalVisible || !modalContent) return null;
    const ModalComp = modalContent.component;
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <ModalComp onClose={() => setModalVisible(false)} />
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestion des Comptes</Text>
      <ScrollView style={{ flex: 1, marginBottom: 10 }}>
        {accounts.map((acc) => (
          <View key={acc.rfid_uid} style={styles.accountCard}>
            <Text>{acc.nom} {acc.prenom}</Text>
            <Text>Adresse: {acc.adresse}</Text>
            <Text>Solde: €{acc.solde?.toFixed(2) || "0.00"}</Text>
            <Text>UID: {acc.rfid_uid}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.title}>Produits</Text>
      <ScrollView style={{ flex: 1, marginBottom: 10 }}>
        {products.map((prod) => (
          <View key={prod.id} style={styles.productCard}>
            <Text>{prod.name}</Text>
            <Text>Prix: €{prod.price.toFixed(2)}</Text>
            <Text>ID: {prod.id}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setModalContent({ component: ModalCreateAccount });
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Créer compte</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setModalContent({ component: ModalAddProduct });
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Ajouter produit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setModalContent({ component: ModalMakePurchase });
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Faire achat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setModalContent({ component: ModalRechargeAccount });
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Recharger compte</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            setModalContent({ component: ModalDeleteAccount });
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Supprimer compte</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            setModalContent({ component: ModalDeleteProduct });
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Supprimer produit</Text>
        </TouchableOpacity>
      </View>

      {renderModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, paddingTop: 40, backgroundColor: "#f2f2f2" },
  title: { fontSize: 20, fontWeight: "bold", marginVertical: 10, textAlign: "center" },
  accountCard: { backgroundColor: "#fff", padding: 10, marginBottom: 8, borderRadius: 5, elevation: 2 },
  productCard: { backgroundColor: "#fff", padding: 10, marginBottom: 8, borderRadius: 5, elevation: 2 },
  buttonRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 10 },
  button: { backgroundColor: "#007AFF", padding: 10, borderRadius: 5, width: "45%" },
  deleteButton: { backgroundColor: "#FF3B30", padding: 10, borderRadius: 5, width: "45%" },
  buttonDisabled: { opacity: 0.5 },
  cancelButton: { backgroundColor: "#999" },
  buttonText: { color: "#fff", fontWeight: "bold", textAlign: "center" },
  modalBackground: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 20 },
  modalContent: { backgroundColor: "#fff", borderRadius: 8, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  input: { borderColor: "#ccc", borderWidth: 1, borderRadius: 5, padding: 8, marginBottom: 12 },
  message: { marginTop: 10, textAlign: "center", color: "#333" },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
  },
  productLabel: {
    fontSize: 16,
  },

});
